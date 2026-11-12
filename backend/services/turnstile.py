"""Validate registration challenges using Cloudflare Siteverify."""
import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from hashlib import sha256

import httpx
from fastapi import HTTPException, Request
from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from backend.models.account import RegistrationChallenge
from backend.services.rate_limits import client_ip, parse_ip

SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
REGISTRATION_ACTION = "register"
TEST_SITEKEY = "1x00000000000000000000AA"
TEST_SECRET = "1x0000000000000000000000000000000AA"
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}
KEY = re.compile(r"0x[A-Za-z0-9_-]{20,}")
DNS_LABEL = re.compile(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?")
UNAVAILABLE = "security check unavailable try again"
EXPIRED = "security check expired or already used try again"


@dataclass(frozen=True)
class TurnstileSettings:
    sitekey: str
    secret: str = field(repr=False)
    hostname: str
    development: bool = False


def turnstile_settings(request: Request) -> TurnstileSettings | None:
    mode = os.environ.get("DATACUBE_TURNSTILE_MODE", "production")
    if mode == "off":
        return None
    if mode == "development":
        peer = parse_ip(request.client.host) if request.client else None
        if request.url.hostname in LOCAL_HOSTS and peer is not None and peer.is_loopback:
            return TurnstileSettings(TEST_SITEKEY, TEST_SECRET, "example.com", development=True)
        raise HTTPException(503, UNAVAILABLE)

    sitekey = os.environ.get("DATACUBE_TURNSTILE_SITE_KEY", "")
    secret = os.environ.get("DATACUBE_TURNSTILE_SECRET_KEY", "")
    hostname = os.environ.get("DATACUBE_TURNSTILE_HOSTNAME", "").lower()
    if (
        mode != "production" or not KEY.fullmatch(sitekey) or not KEY.fullmatch(secret)
        or sitekey == secret or not 1 <= len(hostname) <= 253 or "." not in hostname
        or parse_ip(hostname) is not None or not all(DNS_LABEL.fullmatch(label) for label in hostname.split("."))
    ):
        raise HTTPException(503, UNAVAILABLE)
    return TurnstileSettings(sitekey, secret, hostname)


def verify_registration(request: Request, token: str | None) -> str | None:
    settings = turnstile_settings(request)
    if settings is None:
        return None
    if not token or not token.strip():
        raise HTTPException(422, "complete the security check")
    if len(token) > 2048 or not token.isascii():
        raise HTTPException(422, "security check rejected try again")
    data = {"secret": settings.secret, "response": token}
    address = client_ip(request)
    if address != "unknown":
        data["remoteip"] = address
    try:
        response = httpx.post(SITEVERIFY_URL, data=data, timeout=5.0, follow_redirects=False)
        response.raise_for_status()
        result = response.json()
    except (httpx.HTTPError, ValueError):
        raise HTTPException(503, UNAVAILABLE) from None

    if not isinstance(result, dict) or not isinstance(result.get("success"), bool):
        raise HTTPException(503, UNAVAILABLE)
    if not result["success"]:
        codes = result.get("error-codes")
        if isinstance(codes, list):
            if "timeout-or-duplicate" in codes:
                raise HTTPException(422, EXPIRED)
            if "invalid-input-response" in codes or "missing-input-response" in codes:
                raise HTTPException(422, "security check rejected try again")
        raise HTTPException(503, UNAVAILABLE)
    if result.get("hostname") != settings.hostname or (
        not settings.development and result.get("action") != REGISTRATION_ACTION
    ):
        raise HTTPException(422, "security check rejected try again")

    # Cloudflare's dummy widget can return the same token for unrelated signups.
    return None if settings.development else sha256(token.encode("ascii")).hexdigest()


def claim_registration_challenge(session: Session, token_hash: str) -> None:
    # Siteverify redemption can take time to propagate. The database's unique key
    # prevents two accounts from being created with one token across app workers.
    now = datetime.now(timezone.utc)
    session.exec(delete(RegistrationChallenge).where(RegistrationChallenge.expires_at <= now))
    session.add(RegistrationChallenge(token_hash=token_hash, expires_at=now + timedelta(minutes=5)))
    try:
        session.flush()
    except IntegrityError:
        session.rollback()
        raise HTTPException(422, EXPIRED) from None
