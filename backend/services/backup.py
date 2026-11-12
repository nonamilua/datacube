"""Export owned solves and restore portable identities in one transaction."""
from collections import defaultdict
from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import and_
from sqlmodel import Session, select

from backend.models.account import Category, Cube
from backend.models.backup import BackupCube, BackupSolve, NativeBackup, RestoreResult
from backend.models.solve import Solve
from backend.services.solve_quota import lock_solve_additions, require_solve_capacity


def utc(timestamp: datetime) -> datetime:
    # SQLite drops timezone information from stored UTC values.
    if timestamp.tzinfo is None:
        return timestamp.replace(tzinfo=timezone.utc)
    return timestamp.astimezone(timezone.utc)


def cube_data(cube: Cube) -> BackupCube:
    return BackupCube(handle=cube.name, catalog_event=cube.catalog_event, catalog_model_id=cube.catalog_model_id)


def owned_rows(user_id: int):
    return (
        select(Solve, Category, Cube)
        .outerjoin(Category, and_(Category.id == Solve.category_id, Category.user_id == user_id))
        .outerjoin(Cube, and_(Cube.id == Solve.cube_id, Cube.user_id == user_id))
        .where(Solve.user_id == user_id)
    )


def export_backup(session: Session, user_id: int) -> NativeBackup:
    events: list[str] = []
    cubes: list[BackupCube] = []
    event_refs: dict[int, int] = {}
    cube_refs: dict[int, int] = {}
    records = []
    rows = session.exec(owned_rows(user_id).order_by(Solve.started_at, Solve.portable_id))
    for solve, event, cube in rows:
        if event is not None and event.id not in event_refs:
            event_refs[event.id] = len(events)
            events.append(event.name)
        if cube is not None and cube.id not in cube_refs:
            cube_refs[cube.id] = len(cubes)
            cubes.append(cube_data(cube))
        records.append(BackupSolve(
            id=solve.portable_id, duration_ms=solve.duration_ms, started_at=utc(solve.started_at),
            penalty=solve.penalty, custom=solve.custom, scramble=solve.scramble,
            event_ref=event_refs[event.id] if event is not None else None,
            cube_ref=cube_refs[cube.id] if cube is not None else None,
        ))
    return NativeBackup(format="datacube", version=1, events=events, cubes=cubes, solves=records)


def restore_backup(session: Session, user_id: int, backup: NativeBackup, *, preview: bool = False) -> RestoreResult:
    if not preview:
        lock_solve_additions(session, user_id)
    existing: dict[UUID, int | None] = {}
    ids = [record.id for record in backup.solves]
    # Bound the parameters per query for SQLite and older installations.
    for start in range(0, len(ids), 500):
        rows = session.exec(select(Solve.portable_id, Solve.cube_id).where(
            Solve.user_id == user_id, Solve.portable_id.in_(ids[start:start + 500]),
        ))
        existing.update(rows.all())

    new_records = [record for record in backup.solves if record.id not in existing]
    result = RestoreResult(imported=len(new_records), skipped=len(existing))
    if preview or not new_records:
        return result

    require_solve_capacity(session, user_id, len(new_records))
    categories = {category.name: category for category in session.exec(select(Category).where(Category.user_id == user_id))}
    new_events = {record.event_ref for record in new_records if record.event_ref is not None}
    for ref in sorted(new_events):
        name = backup.events[ref]
        if name not in categories:
            categories[name] = Category(user_id=user_id, name=name)
            session.add(categories[name])

    cubes = session.exec(select(Cube).where(Cube.user_id == user_id).order_by(Cube.id.desc()))
    cubes_by_id = {cube.id: cube_data(cube) for cube in cubes}
    linked_cubes: dict[int, int] = {}
    used_cubes: set[int] = set()
    for record in backup.solves:
        ref = record.cube_ref
        cube_id = existing.get(record.id)
        # Anchor repeated legacy cube identities only if the file specifies the exact same metadata.
        if ref is not None and ref not in linked_cubes and cube_id is not None and cube_id not in used_cubes:
            if cubes_by_id.get(cube_id) == backup.cubes[ref]:
                linked_cubes[ref] = cube_id
                used_cubes.add(cube_id)

    matches = defaultdict(list)
    for cube_id, metadata in cubes_by_id.items():
        if cube_id not in used_cubes:
            matches[metadata].append(cube_id)
    new_cubes = {record.cube_ref for record in new_records if record.cube_ref is not None}
    created_cubes = {}
    for ref in sorted(new_cubes - linked_cubes.keys()):
        metadata = backup.cubes[ref]
        if matches[metadata]:
            linked_cubes[ref] = matches[metadata].pop()
        else:
            cube = Cube(user_id=user_id, name=metadata.handle, catalog_event=metadata.catalog_event, catalog_model_id=metadata.catalog_model_id)
            session.add(cube)
            created_cubes[ref] = cube
    session.flush()
    linked_cubes.update({ref: cube.id for ref, cube in created_cubes.items()})

    session.add_all([
        Solve(
            id=uuid4(), portable_id=record.id, user_id=user_id,
            duration_ms=record.duration_ms, started_at=record.started_at,
            penalty=record.penalty, custom=record.custom, scramble=record.scramble,
            category_id=categories[backup.events[record.event_ref]].id if record.event_ref is not None else None,
            cube_id=linked_cubes[record.cube_ref] if record.cube_ref is not None else None,
        )
        for record in new_records
    ])
    session.commit()
    return result
