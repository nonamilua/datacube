from concurrent.futures import ThreadPoolExecutor
from contextlib import nullcontext
from datetime import datetime, timezone
from threading import Barrier
from uuid import uuid4

import pytest
from sqlmodel import Session, select

from backend.models.solve import Solve
from backend.services import rate_limits, solve_quota
from backend.tests.test_backup import backup, export, register_destination
from backend.tests.test_solve_import import group, record
from backend.tests.test_solves import client, payload


@pytest.fixture(autouse=True)
def small_limit(monkeypatch):
    monkeypatch.setattr(solve_quota, "SOLVE_LIMIT", 2)


def assert_quota(response):
    assert response.status_code == 422, response.text
    assert response.json() == {"detail": "solve limit reached"}
    assert response.headers["X-Datacube-Solve-Limit"] == str(solve_quota.SOLVE_LIMIT)


def test_timer_exact_boundary_duplicate_retry_and_deletion(client):
    first, second, waiting = payload(), payload(), payload()
    assert client.post("/api/solves", json=first).status_code == 201
    assert client.post("/api/solves", json=second).status_code == 201
    assert client.post("/api/solves", json=second).status_code == 200
    assert_quota(client.post("/api/solves", json=waiting))
    assert client.delete(f'/api/solves/{first["id"]}').status_code == 204
    assert client.post("/api/solves", json=waiting).status_code == 201
    assert client.get("/api/solves/all").json()["total"] == 2


def test_histories_above_lowered_limit_stay_accessible_and_accounts_are_independent(client, monkeypatch):
    first, second = payload(), payload()
    assert client.post("/api/solves", json=first).status_code == 201
    assert client.post("/api/solves", json=second).status_code == 201
    monkeypatch.setattr(solve_quota, "SOLVE_LIMIT", 1)

    assert client.post("/api/solves", json=first).status_code == 200
    assert client.get("/api/solves/history").status_code == 200
    assert client.patch(f'/api/solves/{first["id"]}', json={"penalty": "DNF"}).status_code == 200
    document = export(client).json()
    assert len(document["solves"]) == 2
    assert client.post("/api/solves/restore", json=document).json() == {"imported": 0, "skipped": 2}
    assert client.delete(f'/api/solves/{second["id"]}').status_code == 204
    assert_quota(client.post("/api/solves", json=payload()))

    register_destination(client)
    assert client.post("/api/solves", json=payload()).status_code == 201
    assert_quota(client.post("/api/solves", json=payload()))
    assert client.get("/api/solves/all").json()["total"] == 1


@pytest.mark.parametrize("format", ["cstimer", "native"])
def test_batch_counts_only_new_solves_and_rejects_over_limit_atomically(client, format):
    organization = client.get("/api/organization").json()
    category = next(item for item in organization["categories"] if item["name"] == "3x3")
    assert client.post("/api/solves", json=payload(category_id=category["id"], **record())).status_code == 201
    saved = client.get("/api/solves/all").json()

    if format == "native":
        url = "/api/solves/restore"
        document = export(client).json()
        document["events"].append("new native event")
        document["cubes"].append({"handle": "new cube", "catalog_event": None, "catalog_model_id": None})
        entries = document["solves"]
        entries.extend({**entries[0], "id": str(uuid4()), "event_ref": 1, "cube_ref": 0} for _ in range(2))
    else:
        url = "/api/solves/import"
        entries = [record(), record(20000), record(30000)]
        document = {"sessions": [group(entries, cube_name="new cube")]}

    assert_quota(client.post(url, json=document))
    assert client.get("/api/solves/all").json() == saved
    assert client.get("/api/organization").json() == organization

    entries.pop()
    assert client.post(url, json=document).json() == {"imported": 1, "skipped": 1}
    assert client.post(url, json=document).json() == {"imported": 0, "skipped": 2}
    assert client.get("/api/solves/all").json()["total"] == 2


def test_concurrent_timer_cstimer_and_native_writes_share_the_last_slot(client, monkeypatch):
    # Exercise the shared database quota even if bulk writes arrive from separate workers.
    monkeypatch.setattr(rate_limits.limiter, "bulk", lambda *_: nullcontext())
    assert client.post("/api/solves", json=payload()).status_code == 201
    operations = [
        ("/api/solves", payload(duration_ms=17500)),
        ("/api/solves/import", {"sessions": [group([record(20000)])]}),
        ("/api/solves/restore", backup()),
    ]
    start = Barrier(len(operations))

    def submit(operation):
        path, document = operation
        start.wait(timeout=10)
        return client.post(path, json=document)

    with ThreadPoolExecutor(max_workers=len(operations)) as pool:
        responses = list(pool.map(submit, operations))
    assert sum(response.is_success for response in responses) == 1
    for response in responses:
        if not response.is_success:
            assert_quota(response)
    assert client.get("/api/solves/all").json()["total"] == 2


def test_legacy_assignment_obeys_same_account_limit(client, monkeypatch, capsys):
    from backend import import_legacy
    from backend.database import engine

    existing = payload()
    assert client.post("/api/solves", json=existing).status_code == 201
    with Session(engine) as session:
        session.add_all([
            Solve(id=uuid4(), duration_ms=1000, started_at=datetime(2026, 10, 4, tzinfo=timezone.utc)),
            Solve(id=uuid4(), duration_ms=2000, started_at=datetime(2026, 10, 4, tzinfo=timezone.utc)),
        ])
        session.commit()

    monkeypatch.setattr(import_legacy, "engine", engine)
    monkeypatch.setattr("sys.argv", ["import_legacy", "tester"])
    with pytest.raises(SystemExit) as error:
        import_legacy.main()
    assert error.value.code == 2
    assert "solve limit reached" in capsys.readouterr().err
    with Session(engine) as session:
        assert len(session.exec(select(Solve).where(Solve.user_id.is_(None))).all()) == 2
    assert client.delete(f'/api/solves/{existing["id"]}').status_code == 204
    import_legacy.main()
    assert client.get("/api/solves/all").json()["total"] == 2
