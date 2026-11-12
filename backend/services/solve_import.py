"""Atomic, account-scoped import with stable IDs and overlap detection."""
from collections import Counter
from datetime import timezone
from uuid import NAMESPACE_URL, uuid5

from fastapi import HTTPException
from sqlmodel import Session, select

from backend.models.account import Category, Cube
from backend.models.solve import Solve
from backend.models.solve_import import ImportResult, SolveImport
from backend.services.cube_catalog import catalog_event, find_model
from backend.services.owned_cubes import resolve_cube
from backend.services.solve_quota import lock_solve_additions, require_solve_capacity


def fingerprint(event, duration, timestamp):
    # SQLite returns naive UTC datetimes; PostgreSQL retains their timezone.
    utc = timestamp.replace(tzinfo=timezone.utc) if timestamp.tzinfo is None else timestamp.astimezone(timezone.utc)
    return event, duration, utc


def persist_import(session: Session, user_id: int, data: SolveImport) -> ImportResult:
    # Validate every catalog reference before creating cubes, categories or solves.
    for group in data.sessions:
        if group.cube_model_id is not None and (not group.cube_name or not find_model(group.event, group.cube_model_id)):
            raise HTTPException(422, "cube model unavailable")

    lock_solve_additions(session, user_id)
    categories = {item.name: item for item in session.exec(select(Category).where(Category.user_id == user_id)).all()}
    names = {group.event for group in data.sessions}
    event_ids = {item.id: name for name, item in categories.items() if name in names}
    existing = session.exec(select(Solve.id, Solve.category_id, Solve.duration_ms, Solve.started_at).where(
        Solve.user_id == user_id, Solve.category_id.in_(event_ids),
    )).all()
    counts = Counter(fingerprint(event_ids[row.category_id], row.duration_ms, row.started_at) for row in existing)
    used_ids = {row.id for row in existing}
    occurrences = Counter()
    new_records = []
    skipped = 0
    for group in data.sessions:
        for record in group.solves:
            key = fingerprint(group.event, record.duration_ms, record.started_at)
            occurrences[key] += 1
            occurrence = occurrences[key]
            if occurrence <= counts[key]:
                skipped += 1
                continue
            # Annotation changes don't create new identities. Repeated identical source
            # records retain their multiplicity, including across selected sessions.
            identity = f"datacube/cstimer/{user_id}/{group.event}/{key[2].isoformat()}/{record.duration_ms}"
            solve_id = uuid5(NAMESPACE_URL, f"{identity}/{occurrence}")
            # A deleted occurrence can leave higher-numbered siblings behind.
            # Keep those records and allocate the next unused occurrence ID.
            while solve_id in used_ids:
                occurrence += 1
                solve_id = uuid5(NAMESPACE_URL, f"{identity}/{occurrence}")
            used_ids.add(solve_id)
            new_records.append((group, record, solve_id))

    require_solve_capacity(session, user_id, len(new_records))
    for name in {group.event for group, _, _ in new_records} - categories.keys():
        category = Category(user_id=user_id, name=name)
        session.add(category)
        categories[name] = category
    session.flush()

    cubes = {}
    for group, record, solve_id in new_records:
        cube_key = group.event, group.cube_name, group.cube_model_id
        if cube_key not in cubes:
            cube = None
            if group.cube_name:
                event = catalog_event(group.event) if group.cube_model_id is not None else None
                if group.cube_model_id is not None:
                    # Prefer the supplied label, then the oldest existing association.
                    matches = session.exec(select(Cube).where(Cube.user_id == user_id, Cube.catalog_event == event, Cube.catalog_model_id == group.cube_model_id).order_by(Cube.id)).all()
                    cube = next((item for item in matches if item.name == group.cube_name), matches[0] if matches else None)
                cube = resolve_cube(session, user_id, cube.name if cube else group.cube_name, event, group.cube_model_id)
            cubes[cube_key] = cube.id if cube else None
        session.add(Solve(id=solve_id, user_id=user_id,
            category_id=categories[group.event].id, cube_id=cubes[cube_key],
            duration_ms=record.duration_ms, started_at=record.started_at,
            penalty=record.penalty, custom=group.custom, scramble=None))
    session.commit()
    return ImportResult(imported=len(new_records), skipped=skipped)
