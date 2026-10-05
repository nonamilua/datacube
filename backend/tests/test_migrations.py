from uuid import uuid4

from alembic import command
from alembic.config import Config
from sqlmodel import Session, create_engine, select

from backend.database import ROOT
from backend.models.account import User, LoginSession
from backend.models.solve import Solve
from backend.services.auth import passwords


def test_phase_two_data_survives_migration(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    monkeypatch.setattr("backend.database.engine", engine)
    config = Config(str(ROOT / "alembic.ini"))
    command.upgrade(config, "0001")
    solve_id = uuid4()
    with engine.begin() as connection:
        connection.exec_driver_sql("INSERT INTO solves (id, duration_ms, started_at, penalty) VALUES (?, ?, ?, ?)", (solve_id.hex, 12345, "2026-10-04 15:00:00", "OK"))
    command.upgrade(config, "head")
    with Session(engine) as session:
        solve = session.get(Solve, solve_id)
        assert solve.duration_ms == 12345
        assert solve.user_id is None
        assert solve.cube_id is None
        user = User(username="test", password_hash=passwords.hash("a secure password"))
        session.add(user)
        session.commit()
        assert user.password_hash.startswith("$argon2id$")
        assert passwords.verify("a secure password", user.password_hash)
    command.check(config)
    engine.dispose()
