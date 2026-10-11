"""Link explicitly selected models to compatible legacy owned cubes."""
from sqlmodel import Session, select

from backend.models.account import Category, Cube
from backend.models.solve import Solve
from backend.services.cube_catalog import catalog_event


def resolve_cube(session: Session, user_id: int, name: str, event: str | None, model_id: str | None) -> Cube:
    target = session.exec(select(Cube).where(Cube.user_id == user_id, Cube.name == name, Cube.catalog_event == event, Cube.catalog_model_id == model_id)).first()
    if model_id is not None:
        legacy = session.exec(select(Cube).where(Cube.user_id == user_id, Cube.name == name, Cube.catalog_model_id == None)).all()
        for cube in legacy:
            solves = session.exec(select(Solve).where(Solve.cube_id == cube.id)).all()
            compatible = []
            for solve in solves:
                category = session.get(Category, solve.category_id) if solve.category_id else None
                if solve.user_id == user_id and category and category.user_id == user_id and catalog_event(category.name) == event:
                    compatible.append(solve)
            # A cube with unrelated or unlabeled solves must not be reassigned wholesale.
            if not compatible and solves:
                continue
            if target is None and len(compatible) == len(solves):
                cube.catalog_event = event
                cube.catalog_model_id = model_id
                session.add(cube)
                target = cube
                continue
            if target is None:
                target = Cube(user_id=user_id, name=name, catalog_event=event, catalog_model_id=model_id)
                session.add(target)
                session.flush()
            for solve in compatible:
                solve.cube_id = target.id
                session.add(solve)
            session.flush()
            if len(compatible) == len(solves):
                session.delete(cube)
        session.flush()
    if target is None:
        target = Cube(user_id=user_id, name=name, catalog_event=event, catalog_model_id=model_id)
        session.add(target)
        session.flush()
    return target
