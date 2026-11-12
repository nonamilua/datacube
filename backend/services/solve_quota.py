"""Check account capacity while holding a database write lock until commit."""
import os

from fastapi import HTTPException
from sqlalchemy import func, update
from sqlmodel import Session, select

from backend.models.account import User
from backend.models.solve import Solve

try:
    SOLVE_LIMIT = int(os.environ.get("DATACUBE_SOLVE_LIMIT", "50000"))
    if SOLVE_LIMIT < 1:
        raise ValueError
except ValueError:
    raise ValueError("DATACUBE_SOLVE_LIMIT must be a positive integer") from None


def lock_solve_additions(session: Session, user_id: int) -> None:
    # SQLite locks writers for the database. PostgreSQL locks the account row.
    # Acquire the lock before reading solves so deduplication and quota use the
    # same committed state. The no-op update holds the lock until commit/rollback.
    statement = update(User).where(User.id == user_id).values(onboarding_acknowledged=User.onboarding_acknowledged)
    session.exec(statement.execution_options(synchronize_session=False))


def require_solve_capacity(session: Session, user_id: int, additions: int) -> None:
    if additions == 0:
        return
    count = session.exec(select(func.count()).select_from(Solve).where(Solve.user_id == user_id)).one()
    if count + additions > SOLVE_LIMIT:
        raise HTTPException(422, "solve limit reached", headers={"X-Datacube-Solve-Limit": str(SOLVE_LIMIT)})
