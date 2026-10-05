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
        assert reopened.get("/api/solves").json() == page
    assert client.post("/api/solves", json={**data, "duration_ms": 1}).status_code == 409


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
