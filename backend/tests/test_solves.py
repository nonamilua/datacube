from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlmodel import Session, create_engine

from backend.database import ROOT, get_session
from backend.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}", connect_args={"check_same_thread": False})
    monkeypatch.setattr("backend.database.engine", engine)
    command.upgrade(Config(str(ROOT / "alembic.ini")), "head")

    def session():
        with Session(engine) as value:
            yield value

    app.dependency_overrides[get_session] = session
    with TestClient(app) as client:
        client.headers["X-Namicubes-Request"] = "1"
        registered = client.post("/api/auth/register", json={"username": "tester", "password": "test password"})
        assert registered.status_code == 201
        client.headers["X-Namicubes-Account"] = str(registered.json()["id"])
        yield client
    app.dependency_overrides.clear()
    engine.dispose()


def payload(**changes):
    return {"id": str(uuid4()), "duration_ms": 12345, "started_at": "2026-10-04T12:00:00-03:00", **changes}


def test_save_reload_and_retry(client):
    data = payload()
    response = client.post("/api/solves", json=data)
    assert response.status_code == 201
    saved = response.json()
    assert saved["duration_ms"] == 12345
    assert saved["started_at"] == "2026-10-04T15:00:00Z"
    assert saved["penalty"] == "OK"
    assert client.post("/api/solves", json=data).status_code == 200
    page = client.get("/api/solves").json()
    assert page == {"items": [saved], "total": 1}
    with TestClient(app) as reopened:
        reopened.cookies.update(client.cookies)
        assert reopened.get("/api/solves").json() == page
    assert client.post("/api/solves", json={**data, "duration_ms": 1}).status_code == 409


def test_initial_custom_tag_normalization_persistence_and_retries(client):
    data = payload(custom="  T PERM  ")
    saved = client.post("/api/solves", json=data)
    assert saved.status_code == 201
    assert saved.json()["custom"] == "t perm"
    assert client.post("/api/solves", json=data).status_code == 200
    assert client.post("/api/solves", json={**data, "custom":"j perm"}).status_code == 409
    assert client.get("/api/solves/all").json()["items"][0]["custom"] == "t perm"
    legacy_retry = {key:value for key,value in data.items() if key != "custom"}
    assert client.post("/api/solves", json=legacy_retry).status_code == 200
    assert client.post("/api/solves", json=payload(custom="ABCDEFGHIJKLM")).json()["custom"] == "abcdefghijkl"
    assert client.post("/api/solves", json=payload(custom="  ")).json()["custom"] is None
    assert client.post("/api/solves", json=payload(custom="t\u0000perm")).status_code == 422
    with TestClient(app) as reopened:
        reopened.cookies.update(client.cookies)
        rows = reopened.get("/api/solves/all").json()["items"]
        assert next(row for row in rows if row["id"] == data["id"])["custom"] == "t perm"


@pytest.mark.parametrize("changes", [
    {"duration_ms": -1}, {"duration_ms": 1.5}, {"duration_ms": "12"},
    {"started_at": "2026-10-04T12:00:00"}, {"penalty": "bad"}, {"user_id": 2},
])
def test_invalid_solve(client, changes):
    assert client.post("/api/solves", json=payload(**changes)).status_code == 422
    assert client.get("/api/solves").json()["total"] == 0


def test_order_and_pagination(client):
    for hour in (12, 14, 13):
        assert client.post("/api/solves", json=payload(started_at=f"2026-10-04T{hour}:00:00Z")).status_code == 201
    page = client.get("/api/solves?limit=1&offset=1").json()
    assert page["total"] == 3
    assert page["items"][0]["started_at"] == "2026-10-04T13:00:00Z"
    assert client.get("/api/solves?limit=0").status_code == 422


def test_all_history_includes_every_owned_solve(client):
    for minute in range(15):
        client.post("/api/solves", json=payload(started_at=f"2026-10-04T12:{minute:02d}:00Z"))
    page = client.get("/api/solves/all").json()
    assert page["total"] == len(page["items"]) == 15
    assert page["items"][0]["started_at"] == "2026-10-04T12:14:00Z"
    with TestClient(app) as other:
        assert other.get("/api/solves/all").status_code == 401
        other.headers["X-Namicubes-Request"] = "1"
        other.post("/api/auth/register", json={"username":"other", "password":"other password"})
        assert other.get("/api/solves/all").json() == {"items": [], "total": 0}


def test_accounts_and_ownership(client):
    events = client.get("/api/organization").json()["categories"]
    expected = {"3x3", "2x2", "4x4", "5x5", "6x6", "7x7", "3bld", "3oh", "clock", "megaminx", "pyraminx", "skewb", "square 1", "4bld", "5bld", "3mbld", "fmc", "fto"}
    assert {event["name"] for event in events} == expected
    data = payload(category_id=events[0]["id"], cube_name="  gan 12  ")
    saved = client.post("/api/solves", json=data)
    assert saved.status_code == 201
    assert client.post("/api/solves", json=data).status_code == 200
    assert client.get("/api/organization").json()["cubes"][0]["name"] == "gan 12"
    with TestClient(app) as other:
        other.headers["X-Namicubes-Request"] = "1"
        registered = other.post("/api/auth/register", json={"username": "other", "password": "other password"})
        assert registered.status_code == 201
        other.headers["X-Namicubes-Account"] = str(registered.json()["id"])
        assert other.get("/api/solves").json() == {"items": [], "total": 0}
        assert other.get("/api/organization").json()["cubes"] == []
        assert other.post("/api/solves", json=data).status_code == 404
        assert other.post("/api/solves", json={**data, "category_id": None}).status_code == 409
        assert other.post("/api/solves", json=payload(user_id=client.headers["X-Namicubes-Account"])).status_code == 422


def test_login_logout_and_csrf(client):
    old_cookie = client.cookies.get("namicubes_session")
    assert client.post("/api/auth/logout").status_code == 204
    with TestClient(app) as replay:
        replay.cookies.set("namicubes_session", old_cookie)
        assert replay.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/solves").status_code == 401
    assert client.post("/api/auth/login", json={"username": "tester", "password": "wrong password"}).status_code == 401
    response = client.post("/api/auth/login", json={"username": "TESTER", "password": "test password"})
    assert response.status_code == 200
    assert "HttpOnly" in response.headers["set-cookie"]
    assert "SameSite=strict" in response.headers["set-cookie"]
    assert client.cookies.get("namicubes_session") != old_cookie
    assert client.post("/api/auth/register", json={"username": "tester", "password": "test password"}).status_code == 409
    client.headers.pop("X-Namicubes-Request")
    assert client.post("/api/auth/logout").status_code == 403
    assert client.get("/api/auth/me").status_code == 200


def test_stale_account_guard(client):
    client.headers["X-Namicubes-Account"] = "99999"
    assert client.post("/api/solves", json=payload()).status_code == 409
    assert client.get("/api/solves").json()["total"] == 0


def test_expired_session(client):
    from datetime import datetime, timedelta, timezone
    from backend.database import engine
    from backend.models.account import LoginSession
    from backend.services.auth import token_hash
    with Session(engine) as session:
        login = session.get(LoginSession, token_hash(client.cookies.get("namicubes_session")))
        login.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        session.add(login)
        session.commit()
    assert client.get("/api/auth/me").status_code == 401
    assert client.post("/api/solves", json=payload()).status_code == 401


def test_delete_solve_permanently(client):
    from backend.database import engine
    from backend.models.solve import Solve
    from uuid import UUID
    data = payload(cube_name="gan 12")
    assert client.post("/api/solves", json=data).status_code == 201
    assert client.delete(f"/api/solves/{data['id']}").status_code == 204
    assert client.get("/api/solves").json() == {"items": [], "total": 0}
    with Session(engine) as session:
        assert session.get(Solve, UUID(data["id"])) is None
    with TestClient(app) as reopened:
        reopened.cookies.update(client.cookies)
        assert reopened.get("/api/solves").json()["total"] == 0
    assert client.delete(f"/api/solves/{data['id']}").status_code == 404
    # Deleting a solve does not remove a reusable cube record.
    assert client.get("/api/organization").json()["cubes"][0]["name"] == "gan 12"


def test_delete_ownership_and_authentication(client):
    data = payload()
    client.post("/api/solves", json=data)
    url = f"/api/solves/{data['id']}"
    with TestClient(app) as other:
        other.headers["X-Namicubes-Request"] = "1"
        assert other.delete(url).status_code == 401
        registered = other.post("/api/auth/register", json={"username": "other", "password": "other password"})
        other.headers["X-Namicubes-Account"] = str(registered.json()["id"])
        assert other.delete(url).status_code == 404
        assert other.delete(f"/api/solves/{uuid4()}").status_code == 404
        other.headers["X-Namicubes-Account"] = client.headers["X-Namicubes-Account"]
        assert other.delete(url).status_code == 409
    assert client.get("/api/solves").json()["total"] == 1
    client.headers.pop("X-Namicubes-Request")
    assert client.delete(url).status_code == 403
    assert client.get("/api/solves").json()["total"] == 1


def test_penalty_changes_preserve_raw_time_and_persist(client):
    data = payload()
    saved = client.post("/api/solves", json=data).json()
    url = f"/api/solves/{data['id']}"
    for penalty in ("+2", "+2", "DNF", "OK"):
        response = client.patch(url, json={"penalty": penalty})
        assert response.status_code == 200
        assert response.json() == {**saved, "penalty": penalty}
        with TestClient(app) as reopened:
            reopened.cookies.update(client.cookies)
            assert reopened.get("/api/solves").json()["items"][0] == response.json()


@pytest.mark.parametrize("data", [{"penalty": "bad"}, {}, {"penalty": "+2", "duration_ms": 1}, {"penalty": "OK", "user_id": 2}])
def test_invalid_penalty_edit(client, data):
    solve = payload()
    client.post("/api/solves", json=solve)
    assert client.patch(f"/api/solves/{solve['id']}", json=data).status_code == 422
    assert client.get("/api/solves").json()["items"][0]["penalty"] == "OK"


def test_penalty_edit_ownership_and_authentication(client):
    data = payload()
    client.post("/api/solves", json=data)
    url = f"/api/solves/{data['id']}"
    with TestClient(app) as other:
        other.headers["X-Namicubes-Request"] = "1"
        assert other.patch(url, json={"penalty": "DNF"}).status_code == 401
        registered = other.post("/api/auth/register", json={"username": "other", "password": "other password"})
        other.headers["X-Namicubes-Account"] = str(registered.json()["id"])
        assert other.patch(url, json={"penalty": "DNF"}).status_code == 404
        other.headers["X-Namicubes-Account"] = client.headers["X-Namicubes-Account"]
        assert other.patch(url, json={"penalty": "DNF"}).status_code == 409
    client.headers.pop("X-Namicubes-Request")
    assert client.patch(url, json={"penalty": "DNF"}).status_code == 403
    assert client.get("/api/solves").json()["items"][0]["penalty"] == "OK"


def test_custom_value_persists_normalizes_and_is_owned(client):
    data = payload()
    client.post("/api/solves", json=data)
    url = f"/api/solves/{data['id']}"
    updated = client.patch(url, json={"penalty": "+2", "custom": "  Cross  "})
    assert updated.status_code == 200
    assert updated.json()["custom"] == "cross"
    assert updated.json()["duration_ms"] == data["duration_ms"]
    assert client.patch(url, json={"penalty": "DNF"}).json()["custom"] == "cross"
    with TestClient(app) as reopened:
        reopened.cookies.update(client.cookies)
        assert reopened.get("/api/solves/all").json()["items"][0]["custom"] == "cross"
    with TestClient(app) as other:
        other.headers["X-Namicubes-Request"] = "1"
        registered = other.post("/api/auth/register", json={"username": "other", "password": "other password"})
        other.headers["X-Namicubes-Account"] = str(registered.json()["id"])
        assert other.patch(url, json={"penalty": "OK", "custom": "changed"}).status_code == 404
    assert client.patch(url, json={"penalty": "OK", "custom": "  "}).json()["custom"] is None


def test_custom_and_cube_limits_and_literal_sql_like_text(client):
    assert client.post("/api/solves", json=payload(cube_name="a" * 13)).status_code == 201
    assert client.get("/api/organization").json()["cubes"][0]["name"] == "a" * 12
    assert client.post("/api/solves", json=payload(cube_name="cube\u0000")).status_code == 422
    data = payload(cube_name="abcdefghijkl")
    assert client.post("/api/solves", json=data).status_code == 201
    url = f"/api/solves/{data['id']}"
    assert client.patch(url, json={"penalty": "OK", "custom": "ABCDEFGHIJKL"}).json()["custom"] == "abcdefghijkl"
    assert client.patch(url, json={"penalty": "OK", "custom": "ABCDEFGHIJKLM"}).json()["custom"] == "abcdefghijkl"
    for value in ("nul\u0000", "line\ntext"):
        assert client.patch(url, json={"penalty": "OK", "custom": value}).status_code == 422
    # Quotes and SQL-like text are ordinary values, never interpolated into SQL.
    text = "';drop--"
    assert client.patch(url, json={"penalty": "OK", "custom": text}).json()["custom"] == text
    assert client.get("/api/solves/all").json()["total"] == 2
    assert any(cube["name"] == "abcdefghijkl" for cube in client.get("/api/organization").json()["cubes"])


def test_catalog_event_routing_and_authentication(client):
    models = client.get("/api/cube-models", params={"event":"3x3"}).json()
    assert any(model["label"] == "DaYan GuHong Pro+" and model["aliases"][0] == "guhong pro+" for model in models)
    for event in ("3bld", "3oh", "3mbld", "fmc"):
        assert client.get("/api/cube-models", params={"event":event}).json() == models
    for event, catalog in (("4bld","4x4"), ("5bld","5x5")):
        assert client.get("/api/cube-models", params={"event":event}).json() == client.get("/api/cube-models", params={"event":catalog}).json()
    assert client.get("/api/cube-models", params={"event":"clock"}).json() == []
    assert client.get("/api/cube-models", params={"event":"../3x3"}).status_code == 422
    with TestClient(app) as anonymous:
        assert anonymous.get("/api/cube-models", params={"event":"3x3"}).status_code == 401


def test_cube_models_remain_distinct_and_custom_handles_do_not_infer_identity(client):
    categories = {item["name"]:item["id"] for item in client.get("/api/organization").json()["categories"]}
    cubes = []
    for event, model_id in (("4x4","4x4-other-yj-mgc"), ("5x5","5x5-other-yj-mgc")):
        data = payload(category_id=categories[event], cube_name="yj mgc", cube_model_id=model_id)
        saved = client.post("/api/solves",json=data)
        assert saved.status_code == 201
        cubes.append(saved.json()["cube_id"])
        assert client.post("/api/solves",json=data).status_code == 200
        assert client.post("/api/solves",json={**data,"cube_model_id":None}).status_code == 200
    custom = client.post("/api/solves",json=payload(category_id=categories["4x4"],cube_name="yj mgc"))
    assert custom.status_code == 201
    cubes.append(custom.json()["cube_id"])
    assert len(set(cubes)) == 3
    records = client.get("/api/organization").json()["cubes"]
    assert next(cube for cube in records if cube["id"] == cubes[2])["catalog_model_id"] is None
    assert client.post("/api/solves",json=payload(category_id=categories["4x4"],cube_name="yj mgc",cube_model_id="5x5-other-yj-mgc")).status_code == 422
    assert client.post("/api/solves",json=payload(cube_name="yj mgc",cube_model_id="4x4-other-yj-mgc")).status_code == 422
    assert client.post("/api/solves",json=payload(category_id=categories["4x4"],cube_name="yj mgc",cube_model_id="invalid")).status_code == 422
    with TestClient(app) as other:
        other.headers["X-Namicubes-Request"] = "1"
        registered = other.post("/api/auth/register",json={"username":"other","password":"other password"})
        other.headers["X-Namicubes-Account"] = str(registered.json()["id"])
        assert other.get("/api/organization").json()["cubes"] == []
        assert other.post("/api/solves",json=payload(category_id=categories["4x4"],cube_name="yj mgc",cube_model_id="4x4-other-yj-mgc")).status_code == 404


def test_explicit_model_selection_links_legacy_solves_and_merges_later_duplicates(client):
    categories = {item["name"]:item["id"] for item in client.get("/api/organization").json()["categories"]}
    old = payload(category_id=categories["3x3"],cube_name="guhong pro+",penalty="+2",scramble="R U")
    original = client.post("/api/solves",json=old).json()
    client.patch(f"/api/solves/{old['id']}",json={"penalty":"+2","custom":"cross"})
    selected = payload(category_id=categories["3x3"],cube_name="guhong pro+",cube_model_id="dayan-guhong-pro-plus")
    new = client.post("/api/solves",json=selected)
    assert new.status_code == 201
    assert new.json()["cube_id"] == original["cube_id"]
    assert client.post("/api/solves",json=old).status_code == 200
    # An unrecognized label stays unassociated until explicitly selected again.
    duplicate = payload(category_id=categories["3x3"],cube_name="guhong pro+")
    extra = client.post("/api/solves",json=duplicate).json()
    assert extra["cube_id"] != original["cube_id"]
    assert client.post("/api/solves",json={**selected,"id":str(uuid4())}).status_code == 201
    cubes = client.get("/api/organization").json()["cubes"]
    assert len(cubes) == 1
    assert cubes[0]["catalog_model_id"] == "dayan-guhong-pro-plus"
    rows = client.get("/api/solves/all").json()["items"]
    assert {row["cube_id"] for row in rows} == {original["cube_id"]}
    saved = next(row for row in rows if row["id"] == old["id"])
    assert (saved["duration_ms"],saved["penalty"],saved["custom"],saved["scramble"]) == (old["duration_ms"],"+2","cross","R U")


def test_legacy_reconciliation_is_account_and_event_scoped_and_skips_ambiguous_aliases(client):
    from backend.reconcile_cubes import reconcile
    categories = {item["name"]:item["id"] for item in client.get("/api/organization").json()["categories"]}
    for event,name in (("3x3","rs3m v5"),("4x4","rs3m v5"),("3x3","gan 15")):
        assert client.post("/api/solves",json=payload(category_id=categories[event],cube_name=name)).status_code == 201
    user_id = int(client.headers["X-Namicubes-Account"])
    provider = app.dependency_overrides[get_session]()
    session = next(provider)
    try:
        assert reconcile(session,user_id) == 1
        session.commit()
        assert reconcile(session,user_id) == 0
    finally:
        provider.close()
    cubes = client.get("/api/organization").json()["cubes"]
    assert next(cube for cube in cubes if cube["name"] == "gan 15")["catalog_model_id"] is None
    labeled = next(cube for cube in cubes if cube["catalog_model_id"] == "moyu-rs3m-v5")
    rows = client.get("/api/solves/all").json()["items"]
    assert next(row for row in rows if row["category_id"] == categories["3x3"] and row["cube_id"] == labeled["id"])
    assert next(row for row in rows if row["category_id"] == categories["4x4"])["cube_id"] != labeled["id"]


def test_scramble_saved_unchanged_retry_consistency_and_immutable_edits(client):
    text = "R' U' F\n(1, -2) / R++ D--"
    data = payload(scramble=text)
    response = client.post("/api/solves", json=data)
    assert response.status_code == 201
    assert response.json()["scramble"] == text
    assert client.post("/api/solves", json=data).status_code == 200
    assert client.post("/api/solves", json={**data, "scramble":"R U"}).status_code == 409
    url = f"/api/solves/{data['id']}"
    assert client.patch(url, json={"penalty":"+2", "custom":"pll"}).json()["scramble"] == text
    assert client.patch(url, json={"penalty":"OK", "scramble":"B L"}).status_code == 422
    with TestClient(app) as reopened:
        reopened.cookies.update(client.cookies)
        assert reopened.get("/api/solves/all").json()["items"][0]["scramble"] == text
    with TestClient(app) as other:
        assert other.get("/api/solves/all").status_code == 401
        other.headers["X-Namicubes-Request"] = "1"
        registered = other.post("/api/auth/register", json={"username":"other", "password":"other password"})
        other.headers["X-Namicubes-Account"] = str(registered.json()["id"])
        assert other.get("/api/solves/all").json()["items"] == []
        assert other.patch(url,json={"penalty":"DNF"}).status_code == 404
    # A pre-feature retry has no scramble key and remains idempotent.
    legacy = payload()
    assert client.post("/api/solves",json=legacy).json()["scramble"] is None
    assert client.post("/api/solves",json=legacy).status_code == 200


@pytest.mark.parametrize("scramble", ["", "  ", "R\u0000U", "R" * 4097])
def test_invalid_scramble_is_rejected(client, scramble):
    assert client.post("/api/solves",json=payload(scramble=scramble)).status_code == 422
    assert client.get("/api/solves/all").json()["items"] == []
