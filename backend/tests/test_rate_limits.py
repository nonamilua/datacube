from concurrent.futures import ThreadPoolExecutor
from ipaddress import ip_network
from threading import Event

from fastapi.testclient import TestClient

from backend.main import app
from backend.routes import auth, backup as backup_routes
from backend.services import rate_limits
from backend.tests.test_backup import backup
from backend.tests.test_solve_import import group
from backend.tests.test_solves import client, payload


def configure_limits(monkeypatch, *, account=6, ip=30, signup=5, login=10, concurrent=2):
    now = [100.0]
    monkeypatch.setattr(rate_limits, "limiter", rate_limits.RequestLimiter(
        bulk_account=account, bulk_ip=ip, signup_ip=signup, login_ip=login, bulk_concurrent=concurrent, clock=lambda: now[0],
    ))
    monkeypatch.setattr(rate_limits, "TRUSTED_PROXIES", ())
    return now


def assert_throttled(response, delay):
    assert response.status_code == 429, response.text
    assert response.json() == {"detail": "too many requests"}
    assert response.headers["Retry-After"] == str(delay)


def signup(browser, name, headers=None):
    return browser.post("/api/auth/register", headers=headers, json={"username": name, "password": "test password"})


def register(browser, name):
    browser.headers["X-Namicubes-Request"] = "1"
    response = signup(browser, name)
    assert response.status_code == 201, response.text
    browser.headers["X-Namicubes-Account"] = str(response.json()["id"])


def test_account_bucket_covers_all_bulk_paths_and_recovers(client, monkeypatch):
    now = configure_limits(monkeypatch)
    document = backup()
    assert client.post("/api/solves/import", json={"sessions": [group()]}).status_code == 200
    assert client.post("/api/solves/restore/preview", json=document).status_code == 200
    assert client.post("/api/solves/restore", json=document).status_code == 200
    for _ in range(3):
        assert client.get("/api/solves/backup").status_code == 200

    now[0] += 42.5
    # Throttle before either upload parser runs, even for an invalid body.
    for path in ("import", "restore/preview", "restore"):
        assert_throttled(client.post(f"/api/solves/{path}", content=b"invalid"), 18)
    with TestClient(app, client=("192.0.2.20", 5000), cookies=client.cookies, headers=client.headers) as other_ip:
        assert_throttled(other_ip.get("/api/solves/backup"), 18)
    assert client.post("/api/solves", json=payload()).status_code == 201

    now[0] += 17.5
    assert client.get("/api/solves/backup").status_code == 200


def test_bulk_ip_bucket_is_shared_by_accounts_but_separate_from_signup(client, monkeypatch):
    configure_limits(monkeypatch, ip=2, signup=1)
    address = ("192.0.2.20", 5000)
    with TestClient(app, client=address, cookies=client.cookies, headers=client.headers) as first, \
            TestClient(app, client=address) as second:
        assert first.get("/api/solves/backup").status_code == 200
        assert first.get("/api/solves/backup").status_code == 200
        register(second, "same_ip_account")
        assert_throttled(second.get("/api/solves/backup"), 60)
        with TestClient(app, client=("192.0.2.21", 5000), cookies=second.cookies, headers=second.headers) as other:
            assert other.get("/api/solves/backup").status_code == 200


def test_signup_checks_connection_ip_before_json_and_hashing(client, monkeypatch):
    now = configure_limits(monkeypatch, signup=1)
    hashes = []
    original_hash = auth.passwords.hash

    def hash_password(value):
        hashes.append(value)
        return original_hash(value)

    monkeypatch.setattr(auth.passwords, "hash", hash_password)
    with TestClient(app, client=("192.0.2.20", 5000), headers={"X-Namicubes-Request": "1"}) as browser:
        assert signup(browser, "first_signup", {"X-Forwarded-For": "198.51.100.1"}).status_code == 201
        spoofed = {"X-Forwarded-For": "198.51.100.2", "Forwarded": "for=198.51.100.2", "X-Real-IP": "198.51.100.2"}
        assert_throttled(signup(browser, "second_signup", spoofed), 60)
        assert_throttled(browser.post("/api/auth/register", content=b"invalid", headers={"Content-Type": "application/json"}), 60)
        assert len(hashes) == 1
        now[0] += 60
        assert signup(browser, "second_signup").status_code == 201
        assert len(hashes) == 2


def test_explicitly_trusted_proxy_uses_nearest_untrusted_ip(client, monkeypatch):
    configure_limits(monkeypatch, signup=1)
    monkeypatch.setattr(rate_limits, "TRUSTED_PROXIES", (ip_network("10.0.0.0/24"),))
    with TestClient(app, client=("10.0.0.1", 5000), headers={"X-Namicubes-Request": "1"}) as proxy:
        assert signup(proxy, "proxied_first", {"X-Forwarded-For": "203.0.113.1, 192.0.2.1, 10.0.0.2"}).status_code == 201
        # Changing a client-supplied prefix does not change the IP bucket.
        assert_throttled(signup(proxy, "proxied_spoof", {"X-Forwarded-For": "203.0.113.2, 192.0.2.1, 10.0.0.2"}), 60)
        assert signup(proxy, "proxied_second", {"X-Forwarded-For": "192.0.2.2, 10.0.0.2"}).status_code == 201
        assert signup(proxy, "fallback_first", {"X-Forwarded-For": "bad-ip"}).status_code == 201
        assert_throttled(signup(proxy, "fallback_second", {"X-Forwarded-For": "192.0.2.3, bad-ip"}), 60)


def test_login_throttles_before_verification_and_recovers(client, monkeypatch):
    now = configure_limits(monkeypatch, login=2, signup=1)
    verify = auth.passwords.verify
    checked = []

    def verify_password(password, password_hash):
        checked.append(password)
        return verify(password, password_hash)

    monkeypatch.setattr(auth.passwords, "verify", verify_password)
    headers = {"X-Namicubes-Request": "1"}
    credentials = {"username": "tester", "password": "test password"}
    path = "/api/auth/login"
    with TestClient(app, client=("192.0.2.20", 5000), headers=headers) as browser, \
            TestClient(app, client=("192.0.2.21", 5000), headers=headers) as other:
        assert browser.post(path, json=credentials).status_code == 200
        assert browser.post(path, json={**credentials, "password": "wrong password"}).status_code == 401
        now[0] += 15
        spoofed = {"X-Forwarded-For": "192.0.2.21", "Forwarded": "for=192.0.2.21", "X-Real-IP": "192.0.2.21"}
        assert_throttled(browser.post(path, headers=spoofed, json=credentials), 45)
        assert_throttled(browser.post(path, content=b"invalid", headers={"Content-Type": "application/json"}), 45)
        assert checked == ["test password", "wrong password"]
        assert other.post(path, json=credentials).status_code == 200
        assert signup(browser, "independent_signup").status_code == 201
        assert browser.get("/api/auth/me").status_code == 200
        now[0] += 45
        assert browser.post(path, json=credentials).status_code == 200


def test_bulk_slots_cover_generation_and_timer_saves_work_while_full(client, monkeypatch):
    configure_limits(monkeypatch, concurrent=2)
    entered = [Event(), Event()]
    release = Event()
    generate = backup_routes.export_backup

    with TestClient(app, client=("192.0.2.20", 5000)) as second, TestClient(app, client=("192.0.2.21", 5000)) as third:
        register(second, "other_account")
        register(third, "third_account")
        owners = [int(client.headers["X-Namicubes-Account"]), int(second.headers["X-Namicubes-Account"])]

        def held_export(session, owner):
            if owner in owners:
                entered[owners.index(owner)].set()
                assert release.wait(timeout=10)
            return generate(session, owner)

        monkeypatch.setattr(backup_routes, "export_backup", held_export)
        with ThreadPoolExecutor(max_workers=2) as pool:
            try:
                first_export = pool.submit(client.get, "/api/solves/backup")
                assert entered[0].wait(timeout=10)
                # A slot is available server-wide, but this account is already using one.
                assert_throttled(client.post("/api/solves/restore/preview", content=b"invalid"), 1)
                second_export = pool.submit(second.get, "/api/solves/backup")
                assert entered[1].wait(timeout=10)
                assert_throttled(third.get("/api/solves/backup"), 1)
                assert client.post("/api/solves", json=payload()).status_code == 201
            finally:
                release.set()
            assert first_export.result().status_code == 200
            assert second_export.result().status_code == 200
        assert third.get("/api/solves/backup").status_code == 200


def test_invalid_upload_releases_bulk_slot(client, monkeypatch):
    configure_limits(monkeypatch, concurrent=1)
    assert client.post("/api/solves/restore", content=b"invalid").status_code == 422
    assert client.get("/api/solves/backup").status_code == 200
