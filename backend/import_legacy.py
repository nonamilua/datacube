"""Assign unowned phase 2 solves to an explicitly chosen local account."""
import argparse

from sqlmodel import Session, select
from fastapi import HTTPException

from backend.database import engine
from backend.models.account import User
from backend.models.solve import Solve
from backend.services.solve_quota import lock_solve_additions, require_solve_capacity


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("username")
    args = parser.parse_args()
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == args.username.lower())).first()
        if not user:
            parser.error("register this username before importing")
        lock_solve_additions(session, user.id)
        solves = session.exec(select(Solve).where(Solve.user_id.is_(None)).with_for_update()).all()
        try:
            require_solve_capacity(session, user.id, len(solves))
        except HTTPException as error:
            parser.error(f"{error.detail}. delete saved solves and try again")
        for solve in solves:
            solve.user_id = user.id
            session.add(solve)
        session.commit()
        print(f"Imported {len(solves)} solves for {user.username}")


if __name__ == "__main__":
    main()
