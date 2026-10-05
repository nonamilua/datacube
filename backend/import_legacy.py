"""Assign unowned phase 2 solves to an explicitly chosen local account."""
import argparse

from sqlmodel import Session, select

from backend.database import engine
from backend.models.account import User
from backend.models.solve import Solve


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("username")
    args = parser.parse_args()
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == args.username.lower())).first()
        if not user:
            parser.error("register this username before importing")
        solves = session.exec(select(Solve).where(Solve.user_id.is_(None))).all()
        for solve in solves:
            solve.user_id = user.id
            session.add(solve)
        session.commit()
        print(f"Imported {len(solves)} solves for {user.username}")


if __name__ == "__main__":
    main()
