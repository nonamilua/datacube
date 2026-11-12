from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
from threading import Barrier

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from backend.main import app
from backend.models.account import RegistrationChallenge, User
from backend.services import turnstile
from backend.tests.test_solves import client

HOSTNAME = "solves.example.test"
SITEKEY = "0x" + "a" * 24
SECRET = "0x" + "b" * 32
TOKEN = "synthetic-turnstile-token"
SUCCESS = {"success": True, "hostname": HOSTNAME, "action": "register"}


@pytest.fixture
def protected(client, monkeypatch):
    monkeypatch.setenv("DATACUBE_TURNSTILE_MODE", "production")
    monkeypatch.setenv("DATACUBE_TURNSTILE_SITE_KEY", SITEKEY)
    monkeypatch.setenv("DATACUBE_TURNSTILE_SECRET_KEY", SECRET)
    monkeypatch.setenv("DATACUBE_TURNSTILE_HOSTNAME", HOSTNAME)
    return client


def register(client, name, token=TOKEN):
    data = {"username": name, "password": "test password"}
    if token is not None:
        data["turnstile_token"] = token
    return client.post("/api/auth/register", json=data)


def siteverify(monkeypatch, result):
    calls = []

    def post(url, **kwargs):
        calls.append((url, kwargs))
        if isinstance(result, Exception):
            raise result
        request = httpx.Request("POST", url)
        if isinstance(result, int):
            return httpx.Response(result, request=request)
        if isinstance(result, bytes):
            return httpx.Response(200, content=result, request=request)
        return httpx.Response(200, json=result, request=request)

    monkeypatch.setattr(turnstile.httpx, "post", post)
    return calls


def assert_no_account(name):
    from backend.database import engine

    with Session(engine) as session:
        assert session.exec(select(User).where(User.username == name)).first() is None


def test_success_returns_only_public_key_and_calls_siteverify_before_signup(protected, monkeypatch):
    calls = siteverify(monkeypatch, SUCCESS)
    public = protected.get("/api/auth/turnstile")
    assert public.json() == {"sitekey": SITEKEY}
    assert public.headers["cache-control"] == "no-store"
    assert SECRET not in public.text
    with TestClient(app, client=("192.0.2.10", 5000), headers={"X-Namicubes-Request": "1"}) as browser:
        response = register(browser, "protected_signup")
        assert response.status_code == 201, response.text
        assert browser.get("/api/auth/me").json()["username"] == "protected_signup"
    assert calls == [(turnstile.SITEVERIFY_URL, {
        "data": {"secret": SECRET, "response": TOKEN, "remoteip": "192.0.2.10"},
        "timeout": 5.0, "follow_redirects": False,
    })]


@pytest.mark.parametrize("token", [None, "", "x" * 2049])
def test_missing_or_oversized_token_rejected_before_siteverify(protected, monkeypatch, token):
    calls = siteverify(monkeypatch, SUCCESS)
    assert register(protected, "blocked_signup", token).status_code == 422
    assert not calls
    assert_no_account("blocked_signup")


@pytest.mark.parametrize("result,message", [
    ({"success": False, "error-codes": ["invalid-input-response"]}, "security check rejected try again"),
    ({"success": False, "error-codes": ["timeout-or-duplicate"]}, turnstile.EXPIRED),
    ({**SUCCESS, "action": "login"}, "security check rejected try again"),
    ({**SUCCESS, "hostname": "another.example.test"}, "security check rejected try again"),
])
def test_rejected_expired_wrong_hostname_or_wrong_action(protected, monkeypatch, result, message):
    siteverify(monkeypatch, result)
    response = register(protected, "blocked_signup")
    assert response.status_code == 422
    assert response.json() == {"detail": message}
    assert_no_account("blocked_signup")


@pytest.mark.parametrize("result", [
    httpx.ReadTimeout("slow connection"), 503, b"bad json", {"success": "true"},
    {"success": False, "error-codes": ["internal-error"]},
    {"success": False, "error-codes": ["invalid-input-secret"]},
])
def test_verification_outage_fails_closed_and_fresh_token_can_retry(protected, monkeypatch, result):
    siteverify(monkeypatch, result)
    response = register(protected, "retry_signup")
    assert response.status_code == 503
    assert response.json() == {"detail": turnstile.UNAVAILABLE}
    assert_no_account("retry_signup")
    siteverify(monkeypatch, SUCCESS)
    assert register(protected, "retry_signup", "fresh-token").status_code == 201


@pytest.mark.parametrize("variable,value", [
    ("DATACUBE_TURNSTILE_SITE_KEY", ""), ("DATACUBE_TURNSTILE_SECRET_KEY", ""),
    ("DATACUBE_TURNSTILE_SITE_KEY", turnstile.TEST_SITEKEY),
    ("DATACUBE_TURNSTILE_SECRET_KEY", turnstile.TEST_SECRET),
    ("DATACUBE_TURNSTILE_HOSTNAME", "https://solves.example.test"),
    ("DATACUBE_TURNSTILE_MODE", "typo"),
])
def test_invalid_configuration_does_not_offer_a_key_or_allow_signup(protected, monkeypatch, variable, value):
    monkeypatch.setenv(variable, value)
    calls = siteverify(monkeypatch, SUCCESS)
    assert protected.get("/api/auth/turnstile").status_code == 503
    assert register(protected, "blocked_signup").status_code == 503
    assert not calls
    assert_no_account("blocked_signup")
    assert protected.get("/api/auth/me").status_code == 200


def test_development_pair_is_loopback_only_and_dummy_success_has_no_action(client, monkeypatch):
    monkeypatch.setenv("DATACUBE_TURNSTILE_MODE", "development")
    calls = siteverify(monkeypatch, {"success": True, "hostname": "example.com"})
    with TestClient(app, base_url="http://localhost", client=("127.0.0.1", 5000), headers=client.headers) as local:
        assert local.get("/api/auth/turnstile").json() == {"sitekey": turnstile.TEST_SITEKEY}
        assert register(local, "local_signup", "XXXX.DUMMY.TOKEN.XXXX").status_code == 201
        assert calls[0][1]["data"]["secret"] == turnstile.TEST_SECRET
    with TestClient(app, base_url="http://localhost", client=("192.0.2.10", 5000), headers=client.headers) as remote:
        assert register(remote, "remote_signup").status_code == 503
    with TestClient(app, base_url="https://solves.example.test", client=("127.0.0.1", 5000), headers=client.headers) as proxy:
        assert proxy.get("/api/auth/turnstile").status_code == 503
    assert len(calls) == 1


def test_concurrent_replay_cannot_create_two_accounts_even_if_siteverify_accepts_both(protected, monkeypatch):
    from backend.database import engine

    barrier = Barrier(2)

    def post(url, **kwargs):
        barrier.wait(timeout=10)
        return httpx.Response(200, json=SUCCESS, request=httpx.Request("POST", url))

    monkeypatch.setattr(turnstile.httpx, "post", post)
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda name: register(protected, name), ("replay_first", "replay_second")))
    assert sorted(response.status_code for response in responses) == [201, 422]
    assert next(response for response in responses if response.status_code == 422).json() == {"detail": turnstile.EXPIRED}
    with Session(engine) as session:
        assert len(session.exec(select(User).where(User.username.in_(["replay_first", "replay_second"]))).all()) == 1
        claims = session.exec(select(RegistrationChallenge)).all()
        assert [claim.token_hash for claim in claims] == [sha256(TOKEN.encode()).hexdigest()]
