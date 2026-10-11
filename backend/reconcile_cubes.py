"""Reconcile one account's legacy cubes using unambiguous exact catalog aliases.

Run only after backing up the database: python -m backend.reconcile_cubes username
"""
import argparse
from sqlmodel import Session, select

from backend.database import engine
from backend.models.account import Category, Cube, User
from backend.models.solve import Solve
from backend.services.cube_catalog import catalog_event, models_for_event
from backend.services.owned_cubes import resolve_cube


def reconcile(session: Session, user_id: int) -> int:
    cubes = session.exec(select(Cube).where(Cube.user_id == user_id, Cube.catalog_model_id == None)).all()
    linked = 0
    for cube in cubes:
        events = session.exec(select(Category.name).join(Solve, Solve.category_id == Category.id).where(Solve.cube_id == cube.id, Solve.user_id == user_id, Category.user_id == user_id)).all()
        for event in sorted({catalog_event(event) for event in events}):
            candidates = [model for model in models_for_event(event) if cube.name in model["aliases"]]
            # Shared aliases and unknown labels are deliberately left untouched.
            if len(candidates) == 1:
                resolve_cube(session,user_id,cube.name,event,candidates[0]["id"])
                linked += 1
    return linked


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("username")
    args = parser.parse_args()
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == args.username)).one()
        linked = reconcile(session,user.id)
        session.commit()
        print(f"reconciled {linked} legacy cube event groups")
