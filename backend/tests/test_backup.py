from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import datetime, timezone
import json
from uuid import uuid4

import pytest
from fastapi import HTTPException, Request
from sqlmodel import Session

from backend.models.account import Category, Cube
from backend.models.backup import NATIVE_BACKUP_BYTES
from backend.models.solve import Solve
from backend.models.solve_import import IMPORT_BYTES
from backend.routes.backup import read_native_body
from backend.tests.test_solves import client, payload


def register_destination(client):
    response = client.post("/api/auth/register", json={"username": "destination", "password": "test password"})
    assert response.status_code == 201, response.text
    client.headers["X-Namicubes-Account"] = str(response.json()["id"])
    return response.json()["id"]


def export(client, username="tester"):
    response = client.get("/api/solves/backup")
    assert response.status_code == 200, response.text
    assert response.headers["content-disposition"] == f'attachment; filename="datacube-backup-{username}.json"'
    assert response.headers["cache-control"] == "no-store"
    return response


def backup():
    return {"format": "datacube", "version": 1, "events": ["3x3"], "cubes": [], "solves": [{
        "id": str(uuid4()), "duration_ms": 12345, "started_at": "2026-10-04T15:00:00.123456Z",
        "penalty": "OK", "custom": None, "scramble": None, "event_ref": 0, "cube_ref": None,
    }]}


def test_backup_roundtrip_keeps_precision_associations_and_identity(client):
    from backend.database import engine

    source = client.get("/api/auth/me").json()["id"]
    portable = [uuid4() for _ in range(4)]
    timestamp = datetime(1968, 10, 4, 15, 12, 31, 123456, tzinfo=timezone.utc)
    scramble = "  R U'\r\n\tF2  "
    with Session(engine) as session:
        event = Category(user_id=source, name="legacy practice")
        old_cube = Cube(user_id=source, name="Legacy Long Handle", catalog_event="3x3", catalog_model_id="retired-model")
        session.add_all([event, old_cube])
        session.flush()
        # Two distinct solves deliberately have the same full contents apart from ID.
        for identity in portable[:2]:
            session.add(Solve(id=identity, portable_id=identity, user_id=source, duration_ms=9123, started_at=timestamp,
                              penalty="+2", custom="PLL", scramble=scramble, category_id=event.id, cube_id=old_cube.id))
        session.add(Solve(id=portable[2], portable_id=portable[2], user_id=source, duration_ms=2**53 + 1,
                          started_at=timestamp, penalty="DNF", custom="", scramble=""))
        session.add(Solve(id=portable[3], portable_id=portable[3], user_id=source, duration_ms=1, started_at=timestamp))
        session.commit()

    original = export(client)
    document = original.json()
    assert document["events"] == ["legacy practice"]
    assert document["cubes"] == [{"handle": "Legacy Long Handle", "catalog_event": "3x3", "catalog_model_id": "retired-model"}]
    records = {row["id"]: row for row in document["solves"]}
    assert records[str(portable[0])] == {"id": str(portable[0]), "duration_ms": 9123, "started_at": "1968-10-04T15:12:31.123456Z",
                                          "penalty": "+2", "custom": "PLL", "scramble": scramble, "event_ref": 0, "cube_ref": 0}
    assert records[str(portable[2])]["duration_ms"] == 2**53 + 1
    assert records[str(portable[2])]["scramble"] == records[str(portable[2])]["custom"] == ""
    assert records[str(portable[3])]["scramble"] is records[str(portable[3])]["custom"] is None
    assert client.post("/api/solves/restore/preview", content=original.content).json() == {"imported": 0, "skipped": 4}

    destination = register_destination(client)
    assert export(client, "destination").json() == {"format": "datacube", "version": 1, "events": [], "cubes": [], "solves": []}
    preview = client.post("/api/solves/restore/preview", content=original.content)
    assert preview.json() == {"imported": 4, "skipped": 0}
    assert client.get("/api/solves/all").json()["total"] == 0
    assert client.get("/api/organization").json()["cubes"] == []
    assert client.post("/api/solves/restore", content=original.content).json() == preview.json()
    assert client.post("/api/solves/restore", content=original.content).json() == {"imported": 0, "skipped": 4}
    assert export(client, "destination").json() == document
    with Session(engine) as session:
        assert all(session.get(Solve, row_id).user_id == source for row_id in portable)
    saved = client.get("/api/solves/all").json()["items"]
    assert {row["id"] for row in saved}.isdisjoint(map(str, portable))
    assert len({row["cube_id"] for row in saved if row["cube_id"] is not None}) == 1
    assert client.get("/api/auth/me").json()["id"] == destination


def test_mixed_backup_skips_changed_id_adds_missing_and_keeps_omitted_solve(client):
    category = next(row for row in client.get("/api/organization").json()["categories"] if row["name"] == "3x3")
    original = client.post("/api/solves", json=payload(category_id=category["id"], custom="old", cube_name="my cube")).json()
    document = export(client).json()
    document["events"][0] = "5x5"
    document["cubes"][0]["handle"] = "replacement cube"
    changed = document["solves"][0]
    changed.update(duration_ms=25678, custom="edited", penalty="DNF")
    assert client.post("/api/solves/restore/preview", json=document).json() == {"imported": 0, "skipped": 1}
    assert client.post("/api/solves/restore", json=document).json() == {"imported": 0, "skipped": 1}
    assert len(client.get("/api/organization").json()["cubes"]) == 1

    omitted = client.post("/api/solves", json=payload(duration_ms=19500)).json()
    new_id = str(uuid4())
    document["solves"].append({**changed, "id": new_id})
    assert client.post("/api/solves/restore/preview", json=document).json() == {"imported": 1, "skipped": 1}
    assert client.post("/api/solves/restore", json=document).json() == {"imported": 1, "skipped": 1}
    assert client.post("/api/solves/restore", json=document).json() == {"imported": 0, "skipped": 2}
    saved = client.get("/api/solves/all").json()["items"]
    assert len(saved) == 3
    assert original in saved and omitted in saved
    reexported = export(client).json()
    added = next(row for row in reexported["solves"] if row["id"] == new_id)
    assert reexported["events"][added["event_ref"]] == "5x5"
    assert reexported["cubes"][added["cube_ref"]]["handle"] == "replacement cube"
    assert added["duration_ms"] == 25678 and added["custom"] == "edited" and added["penalty"] == "DNF"


def test_edited_export_creates_separate_copy_in_fresh_account(client):
    source = client.get("/api/auth/me").json()["id"]
    category = next(row for row in client.get("/api/organization").json()["categories"] if row["name"] == "3x3")
    original = client.post("/api/solves", json=payload(category_id=category["id"], custom="original", cube_name="old cube")).json()
    source_backup = export(client).json()
    edited = deepcopy(source_backup)
    edited["events"][0] = "new event"
    edited["cubes"][0].update(handle="a long edited legacy handle", catalog_event="3x3", catalog_model_id="retired-model")
    edited["solves"][0].update(started_at="2026-10-04T15:12:31.123456Z", duration_ms=23456, penalty="+2", custom="new", scramble="  R U'\r\n\t  ")

    register_destination(client)
    assert client.post("/api/solves/restore/preview", json=edited).json() == {"imported": 1, "skipped": 0}
    assert client.post("/api/solves/restore", json=edited).json() == {"imported": 1, "skipped": 0}
    assert export(client, "destination").json() == edited
    assert client.get("/api/solves/all").json()["items"][0]["id"] != original["id"]

    logged_in = client.post("/api/auth/login", json={"username": "tester", "password": "test password"})
    assert logged_in.status_code == 200 and logged_in.json()["id"] == source
    client.headers["X-Namicubes-Account"] = str(source)
    assert export(client).json() == source_backup
    assert client.get("/api/solves/all").json()["items"] == [original]


def test_export_above_legacy_size_limit_restores_in_one_file(client):
    from backend.database import engine

    source = client.get("/api/auth/me").json()["id"]
    scramble = "R U " * 1024
    count = 2600
    with Session(engine) as session:
        session.add_all([
            Solve(id=uuid4(), user_id=source, duration_ms=index, started_at=datetime(2026, 10, 4, tzinfo=timezone.utc), scramble=scramble)
            for index in range(count)
        ])
        session.commit()
    original = export(client).content
    assert len(original) > IMPORT_BYTES
    assert client.post("/api/solves/import", content=original).status_code == 413

    register_destination(client)
    expected = {"imported": count, "skipped": 0}
    assert client.post("/api/solves/restore/preview", content=original).json() == expected
    assert client.post("/api/solves/restore", content=original).json() == expected
    assert export(client, "destination").content == original


@pytest.mark.parametrize("invalid", [
    {"duration_ms": True}, {"started_at": "2026-10-04T15:00:00.1234567Z"}, {"started_at": 123},
    {"cube_ref": 0}, {"event_ref": 1}, {"event_ref": True}, {"custom": "abcdefghijklm"},
    {"penalty": "2000"}, {"user_id": 1}, {"scramble": "R" * 4097},
])
def test_entire_backup_is_validated_before_preview_and_restore(client, invalid):
    document = backup()
    document["solves"].append({**document["solves"][0], "id": str(uuid4()), **invalid})
    assert client.post("/api/solves/restore/preview", json=document).status_code == 422
    assert client.post("/api/solves/restore", json=document).status_code == 422
    assert export(client).json()["solves"] == []


def test_version_duplicates_size_and_account_guard(client):
    document = backup()
    duplicate = deepcopy(document)
    duplicate["solves"].append(duplicate["solves"][0])
    for invalid in [{**document, "version": 2}, {**document, "version": True}, duplicate]:
        assert client.post("/api/solves/restore", json=invalid).status_code == 422
    oversized_legacy = b'{"session1":[]}' + b" " * IMPORT_BYTES
    legacy_response = client.post("/api/solves/restore/preview", content=oversized_legacy)
    assert legacy_response.status_code == 413 and legacy_response.json() == {"detail": "file exceeds 10 mib"}
    assert client.post("/api/solves/restore", json=document, headers={"X-Namicubes-Account": "9999"}).status_code == 409
    assert client.get("/api/solves/backup", headers={"X-Namicubes-Account": "9999"}).status_code == 409
    client.post("/api/auth/logout")
    assert client.get("/api/solves/backup").status_code == 401
    assert client.post("/api/solves/restore/preview", json=document).status_code == 401


@pytest.mark.parametrize("suffix", ["/preview", ""])
def test_native_restore_accepts_exact_byte_limit_and_rejects_one_byte_more(client, suffix):
    content = b"\xef\xbb\xbf" + json.dumps(backup()).encode()
    exact = content.ljust(NATIVE_BACKUP_BYTES, b" ")
    endpoint = f"/api/solves/restore{suffix}"

    rejected = client.post(endpoint, content=exact + b" ")
    assert rejected.status_code == 413
    assert rejected.json() == {"detail": "backup exceeds 32 mib"}
    assert client.get("/api/solves/all").json()["total"] == 0

    accepted = client.post(endpoint, content=exact)
    assert accepted.status_code == 200, accepted.text
    assert accepted.json() == {"imported": 1, "skipped": 0}


def test_native_upload_stops_reading_at_limit_without_content_length():
    import asyncio

    chunks = iter([b" " * NATIVE_BACKUP_BYTES, b" "])

    async def receive():
        chunk = next(chunks, None)
        assert chunk is not None, "restore kept reading after exceeding the upload limit"
        return {"type": "http.request", "body": chunk, "more_body": True}

    request = Request({"type": "http", "headers": []}, receive)
    with pytest.raises(HTTPException) as error:
        asyncio.run(read_native_body(request))
    assert error.value.status_code == 413


def test_concurrent_restore_cannot_duplicate_rows(client):
    document = backup()
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: client.post("/api/solves/restore", json=document), range(2)))
    assert all(result.status_code in (200, 429, 503) for result in results)
    assert sum(result.json()["imported"] for result in results if result.status_code == 200) == 1
    assert client.post("/api/solves/restore", json=document).json() == {"imported": 0, "skipped": 1}
