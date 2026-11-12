from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from uuid import NAMESPACE_URL, uuid5

import pytest
from sqlalchemy.exc import OperationalError
from sqlmodel import Session
from backend.tests.test_solves import client, payload


def record(duration=12345, timestamp="2023-11-14T22:13:20Z", penalty="OK"):
    return {"duration_ms": duration, "started_at": timestamp, "penalty": penalty}


def group(records=None, **values):
    return {"event": "3x3", "solves": records if records is not None else [record()], **values}


def send(client, *sessions):
    return client.post("/api/solves/import", json={"sessions": list(sessions)})


def test_import_preserves_raw_duration_penalties_utc_and_assignments(client):
    response = send(client, group([record(), record(23456, penalty="+2"), record(34567, penalty="DNF")], cube_name=" MY CUBE ", custom=" PLL "))
    assert response.status_code == 200, response.text
    assert response.json() == {"imported": 3, "skipped": 0}
    rows = client.get("/api/solves/all").json()["items"]
    assert {row["duration_ms"]: row["penalty"] for row in rows} == {12345: "OK", 23456: "+2", 34567: "DNF"}
    assert all(row["started_at"] == "2023-11-14T22:13:20Z" and row["custom"] == "pll" and row["scramble"] is None for row in rows)
    assert len({row["cube_id"] for row in rows}) == 1
    assert client.get("/api/organization").json()["cubes"][0]["name"] == "my cube"


def test_overlaps_and_retries_keep_existing_solve_ids_and_annotations(client):
    category = next(item for item in client.get("/api/organization").json()["categories"] if item["name"] == "3x3")
    original = client.post("/api/solves", json=payload(category_id=category["id"], duration_ms=12345, started_at="2023-11-14T19:13:20-03:00", custom="keep", penalty="DNF", cube_name="original")).json()
    source = group([record(), record(20000), record(30000)], custom="new", cube_name="new cube")
    assert send(client, source).json() == {"imported": 2, "skipped": 1}
    client.patch(f'/api/solves/{original["id"]}', json={"penalty": "+2", "custom": "edited"})
    source["cube_name"] = "changed"
    assert send(client, source).json() == {"imported": 0, "skipped": 3}
    rows = client.get("/api/solves/all").json()["items"]
    saved = next(row for row in rows if row["id"] == original["id"])
    assert saved["custom"] == "edited" and saved["penalty"] == "+2" and saved["cube_id"] == original["cube_id"]
    assert len(rows) == 3
    assert "changed" not in {cube["name"] for cube in client.get("/api/organization").json()["cubes"]}


def test_identical_records_retain_multiplicity_and_events_stay_distinct(client):
    assert send(client, group([record(), record()])).json() == {"imported": 2, "skipped": 0}
    assert send(client, group(), group()).json() == {"imported": 0, "skipped": 2}
    assert send(client, group([record()] * 3)).json() == {"imported": 1, "skipped": 2}
    assert send(client, group(event="4x4")).json() == {"imported": 1, "skipped": 0}
    assert client.get("/api/solves/all").json()["total"] == 4


def test_reimport_after_deleting_an_identical_occurrence_keeps_surviving_records(client):
    source = group([record(), record()])
    assert send(client, source).json()["imported"] == 2
    user_id = client.get("/api/auth/me").json()["id"]
    first = uuid5(NAMESPACE_URL, f"datacube/cstimer/{user_id}/3x3/2023-11-14T22:13:20+00:00/12345/1")
    assert client.delete(f"/api/solves/{first}").status_code == 204
    survivor = client.get("/api/solves/all").json()["items"][0]["id"]
    client.patch(f"/api/solves/{survivor}", json={"penalty": "DNF", "custom": "keep"})
    assert send(client, source).json() == {"imported": 1, "skipped": 1}
    assert send(client, source).json() == {"imported": 0, "skipped": 2}
    rows = client.get("/api/solves/all").json()["items"]
    assert len(rows) == 2
    assert next(row for row in rows if row["id"] == survivor)["custom"] == "keep"


def test_selected_model_reuses_existing_cube_even_with_another_label(client):
    model = client.get("/api/cube-models?event=3x3").json()[0]
    category = next(item for item in client.get("/api/organization").json()["categories"] if item["name"] == "3x3")
    original = client.post("/api/solves", json=payload(category_id=category["id"], cube_name="my cube", cube_model_id=model["id"])).json()
    response = send(client, group(cube_name="new label", cube_model_id=model["id"]))
    assert response.status_code == 200, response.text
    rows = client.get("/api/solves/all").json()["items"]
    assert {row["cube_id"] for row in rows} == {original["cube_id"]}
    cubes = client.get("/api/organization").json()["cubes"]
    assert len(cubes) == 1 and cubes[0]["name"] == "my cube"


def test_explicit_catalog_selection_links_same_label_legacy_cube(client):
    model = client.get("/api/cube-models?event=3x3").json()[0]
    category = next(item for item in client.get("/api/organization").json()["categories"] if item["name"] == "3x3")
    original = client.post("/api/solves", json=payload(category_id=category["id"], cube_name="legacy")).json()
    assert send(client, group(cube_name="legacy", cube_model_id=model["id"])).status_code == 200
    cubes = client.get("/api/organization").json()["cubes"]
    assert len(cubes) == 1 and cubes[0]["id"] == original["cube_id"] and cubes[0]["catalog_model_id"] == model["id"]


def test_invalid_later_session_leaves_solves_and_cubes_untouched(client):
    response = send(client, group(cube_name="no orphan"), group(event="4x4", cube_name="bad", cube_model_id="not-a-model"))
    assert response.status_code == 422
    assert client.get("/api/solves/all").json()["total"] == 0
    assert client.get("/api/organization").json()["cubes"] == []


@pytest.mark.parametrize("change", [
    {"duration_ms": True}, {"duration_ms": -1}, {"duration_ms": 1.5}, {"duration_ms": 2**53},
    {"started_at": "2023-01-01T00:00:00"}, {"started_at": 1700000000}, {"started_at": "1969-01-01T00:00:00Z"},
    {"penalty": "2000"}, {"user_id": 1}, {"scramble": "R U"},
])
def test_backend_rejects_invalid_records_without_partial_import(client, change):
    invalid = {**record(20000), **change}
    assert send(client, group([record(), invalid])).status_code == 422
    assert client.get("/api/solves/all").json()["total"] == 0


def test_limits_and_untrusted_assignments(client):
    assert send(client, group(event="unknown")).status_code == 422
    assert send(client, group(user_id=999)).status_code == 422
    assert send(client, group(cube_name="bad\x00text")).status_code == 422
    assert send(client, group(custom="bad\ntext")).status_code == 422
    assert send(client, group(cube_model_id="missing label")).status_code == 422
    assert send(client, group([record()] * 25000), group([record()] * 25001)).status_code == 422
    assert client.post("/api/solves/import", content=b" " * (10 * 1024 * 1024 + 1)).status_code == 413
    assert client.get("/api/solves/all").json()["total"] == 0


def test_ownership_stale_account_guard_and_authentication(client):
    first_user = client.get("/api/auth/me").json()["id"]
    assert send(client, group(cube_name="owned")).json()["imported"] == 1
    other = client.post("/api/auth/register", json={"username": "another", "password": "another password"}).json()["id"]
    assert send(client, group()).status_code == 409
    client.headers["X-Namicubes-Account"] = str(other)
    assert client.get("/api/solves/all").json()["total"] == 0
    assert send(client, group(cube_name="owned")).json()["imported"] == 1
    second_id = client.get("/api/solves/all").json()["items"][0]["id"]
    client.post("/api/auth/login", json={"username": "tester", "password": "test password"})
    client.headers["X-Namicubes-Account"] = str(first_user)
    assert client.get("/api/solves/all").json()["total"] == 1
    assert client.get("/api/solves/all").json()["items"][0]["id"] != second_id
    client.cookies.clear()
    assert send(client, group()).status_code == 401


def test_failed_commit_rolls_back_and_retry_is_safe(client, monkeypatch):
    real_commit = Session.commit
    def fail_commit(self):
        raise OperationalError("commit", {}, Exception("database busy"))
    monkeypatch.setattr(Session, "commit", fail_commit)
    assert send(client, group(cube_name="rollback")).status_code == 503
    assert client.get("/api/solves/all").json()["total"] == 0
    assert client.get("/api/organization").json()["cubes"] == []
    monkeypatch.setattr(Session, "commit", real_commit)
    assert send(client, group(cube_name="rollback")).json() == {"imported": 1, "skipped": 0}
    assert send(client, group(cube_name="rollback")).json() == {"imported": 0, "skipped": 1}


def test_concurrent_identical_imports_never_duplicate_solves(client):
    source = group([record(10000 + i) for i in range(100)], cube_name="concurrent")
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: send(client, deepcopy(source)), range(2)))
    assert all(response.status_code in (200, 429, 503) for response in responses)
    assert any(response.status_code == 200 for response in responses)
    assert send(client, source).json() == {"imported": 0, "skipped": 100}
    assert client.get("/api/solves/all").json()["total"] == 100
    assert len(client.get("/api/organization").json()["cubes"]) == 1
