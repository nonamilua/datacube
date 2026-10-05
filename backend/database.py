import os
from pathlib import Path

from sqlmodel import Session, create_engine
from sqlalchemy import event
from sqlalchemy.engine import Engine

ROOT = Path(__file__).resolve().parent.parent
DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{(ROOT / 'backend' / 'solves.db').as_posix()}")
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)


@event.listens_for(Engine, "connect")
def enforce_sqlite_foreign_keys(connection, _record):
    from sqlite3 import Connection
    if isinstance(connection, Connection):
        connection.execute("PRAGMA foreign_keys=ON")


def get_session():
    with Session(engine) as session:
        yield session
