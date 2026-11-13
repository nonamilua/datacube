"""Process-local request limits and bulk operation slots."""
import os
from collections import deque
from contextlib import contextmanager
from ipaddress import ip_address, ip_network
from math import ceil
from threading import Lock
from time import monotonic

from fastapi import Depends, HTTPException, Request

from backend.models.account import User
from backend.services.auth import current_user

WINDOW_SECONDS = 60


def positive_setting(name: str, default: int) -> int:
    try:
        value = int(os.environ.get(name, str(default)))
        if value > 0:
            return value
    except ValueError:
        pass
    raise ValueError(f"{name} must be a positive integer")


TRUSTED_PROXIES = tuple(
    ip_network(entry.strip()) for entry in os.environ.get("DATACUBE_TRUSTED_PROXIES", "").split(",") if entry.strip()
)


def parse_ip(value: str):
    if "%" in value:
        return None
    try:
        address = ip_address(value)
    except ValueError:
        return None
    return getattr(address, "ipv4_mapped", None) or address


def client_ip(request: Request) -> str:
    peer = parse_ip(request.client.host) if request.client else None
    if peer is None:
        return "unknown"
    if any(peer in network for network in TRUSTED_PROXIES):
        # A trusted proxy must append the actual upstream address or replace the header.
        # Walk back through trusted hops to find the closest untrusted address.
        forwarded = ",".join(request.headers.getlist("x-forwarded-for"))
        for value in reversed(forwarded.split(",")):
            address = parse_ip(value.strip())
            if address is None:
                break
            if not any(address in network for network in TRUSTED_PROXIES):
                return str(address)
    return str(peer)


def throttled(retry_after: int) -> HTTPException:
    return HTTPException(429, "too many requests", headers={"Retry-After": str(retry_after)})


class RequestLimiter:
    def __init__(self, *, bulk_account: int, bulk_ip: int, signup_ip: int, login_ip: int, bulk_concurrent: int, clock=monotonic):
        self.bulk_account = bulk_account
        self.bulk_ip = bulk_ip
        self.signup_ip = signup_ip
        self.login_ip = login_ip
        self.bulk_concurrent = bulk_concurrent
        self.clock = clock
        self.lock = Lock()
        self.hits: dict[tuple[str, int | str], deque[float]] = {}
        self.active_accounts: set[int] = set()
        self.next_cleanup = 0.0

    def check(self, limits: list[tuple[tuple[str, int | str], int]], now: float) -> None:
        # Run with the lock held so all applicable limits admit and count together.
        cutoff = now - WINDOW_SECONDS
        if now >= self.next_cleanup:
            self.hits = {key: hits for key, hits in self.hits.items() if hits and hits[-1] > cutoff}
            self.next_cleanup = now + WINDOW_SECONDS
        retry = 0
        for key, limit in limits:
            hits = self.hits.get(key)
            if hits is None:
                continue
            while hits and hits[0] <= cutoff:
                hits.popleft()
            if len(hits) >= limit:
                retry = max(retry, 1, ceil(hits[0] + WINDOW_SECONDS - now))
        if retry:
            raise throttled(retry)

    def auth(self, address: str, *, signup: bool) -> None:
        key = ("signup_ip" if signup else "login_ip", address)
        limit = self.signup_ip if signup else self.login_ip
        with self.lock:
            now = self.clock()
            self.check([(key, limit)], now)
            self.hits.setdefault(key, deque()).append(now)

    @contextmanager
    def bulk(self, account: int, address: str):
        limits = [(("bulk_account", account), self.bulk_account), (("bulk_ip", address), self.bulk_ip)]
        with self.lock:
            now = self.clock()
            self.check(limits, now)
            if account in self.active_accounts or len(self.active_accounts) >= self.bulk_concurrent:
                raise throttled(1)
            for key, _ in limits:
                self.hits.setdefault(key, deque()).append(now)
            self.active_accounts.add(account)
        try:
            yield
        finally:
            with self.lock:
                self.active_accounts.remove(account)


limiter = RequestLimiter(
    bulk_account=positive_setting("DATACUBE_BULK_ACCOUNT_PER_MINUTE", 6),
    bulk_ip=positive_setting("DATACUBE_BULK_IP_PER_MINUTE", 30),
    signup_ip=positive_setting("DATACUBE_SIGNUP_IP_PER_MINUTE", 5),
    login_ip=positive_setting("DATACUBE_LOGIN_IP_PER_MINUTE", 10),
    bulk_concurrent=positive_setting("DATACUBE_BULK_CONCURRENT", 2),
)


def limit_auth(request: Request, *, signup: bool) -> None:
    limiter.auth(client_ip(request), signup=signup)


async def bulk_user(request: Request, user: User = Depends(current_user)):
    if request.headers.get("x-namicubes-account") != str(user.id):
        raise HTTPException(409, "account changed sign in again")
    with limiter.bulk(user.id, client_ip(request)):
        yield user
