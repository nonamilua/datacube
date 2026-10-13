from uuid import uuid4

from alembic import command
from alembic.config import Config
from sqlmodel import Session, create_engine, select

from backend.database import ROOT
from backend.models.account import User, LoginSession
from backend.models.solve import Solve
from backend.services.auth import passwords
from sqlalchemy.exc import IntegrityError
import pytest


def test_onboarding_migration_acknowledges_existing_users_and_preserves_data(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'onboarding.db'}")
    monkeypatch.setattr("backend.database.engine",engine)
    config = Config(str(ROOT / "alembic.ini"))
    command.upgrade(config,"0006")
    with engine.begin() as connection:
        connection.exec_driver_sql("INSERT INTO users (id,username,password_hash,created_at) VALUES (1,'existing','preserved hash','2026-10-04')")
        connection.exec_driver_sql("INSERT INTO cubes (id,user_id,name) VALUES (1,1,'cube')")
        connection.exec_driver_sql("INSERT INTO categories (id,user_id,name) VALUES (1,1,'3x3')")
        connection.exec_driver_sql("INSERT INTO login_sessions (token_hash,user_id,expires_at) VALUES ('hash',1,'2030-01-01')")
        connection.exec_driver_sql("INSERT INTO solves (id,user_id,cube_id,category_id,duration_ms,started_at,penalty,custom,scramble) VALUES ('existing',1,1,1,12345,'2026-10-04','+2','tag','R U')")
        tables = ['cubes','categories','login_sessions','solves']
        before = {table:connection.exec_driver_sql(f"SELECT * FROM {table}").fetchall() for table in tables}
    command.upgrade(config,"head")
    with engine.begin() as connection:
        assert connection.exec_driver_sql("SELECT username,password_hash,created_at,onboarding_acknowledged FROM users WHERE id=1").one() == ('existing','preserved hash','2026-10-04',1)
        assert before == {table:connection.exec_driver_sql(f"SELECT * FROM {table}").fetchall() for table in tables}
        connection.exec_driver_sql("INSERT INTO users (username,password_hash,created_at) VALUES ('new','new hash','2026-10-12')")
        assert connection.exec_driver_sql("SELECT onboarding_acknowledged FROM users WHERE username='new'").scalar() == 0
        assert connection.exec_driver_sql("PRAGMA foreign_key_check").fetchall() == []
    command.check(config)
    engine.dispose()


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
        assert solve.custom is None
        assert solve.scramble is None
        user = User(username="test", password_hash=passwords.hash("a secure password"))
        session.add(user)
        session.commit()
        assert user.password_hash.startswith("$argon2id$")
        assert passwords.verify("a secure password", user.password_hash)
    command.check(config)
    engine.dispose()


def test_twelve_character_migration_preserves_data_and_enforces_limit(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'tags.db'}")
    monkeypatch.setattr("backend.database.engine", engine)
    config = Config(str(ROOT / "alembic.ini"))
    command.upgrade(config, "0004")
    solve_id = uuid4()
    with engine.begin() as connection:
        connection.exec_driver_sql("INSERT INTO solves (id, duration_ms, started_at, penalty, custom, scramble) VALUES (?, ?, ?, ?, ?, ?)", (solve_id.hex, 12345, "2026-10-04 15:00:00", "+2", "old tag", "R U'"))
    command.upgrade(config, "head")
    with engine.begin() as connection:
        row = connection.exec_driver_sql("SELECT duration_ms, penalty, custom, scramble FROM solves WHERE id = ?", (solve_id.hex,)).one()
        assert tuple(row) == (12345, "+2", "old tag", "R U'")
        connection.exec_driver_sql("UPDATE solves SET custom = ? WHERE id = ?", ("abcdefghijkl", solve_id.hex))
    with pytest.raises(IntegrityError), engine.begin() as connection:
        connection.exec_driver_sql("UPDATE solves SET custom = ? WHERE id = ?", ("abcdefghijklm", solve_id.hex))
    command.check(config)
    engine.dispose()


def test_catalog_migration_preserves_owned_cube_ids_and_solve_links(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'models.db'}")
    monkeypatch.setattr("backend.database.engine", engine)
    config = Config(str(ROOT / "alembic.ini"))
    command.upgrade(config, "0005")
    solve_id = uuid4()
    with engine.begin() as connection:
        connection.exec_driver_sql("INSERT INTO users (id, username, password_hash, created_at) VALUES (1, 'test', 'placeholder', '2026-10-04')")
        connection.exec_driver_sql("INSERT INTO cubes (id, user_id, name) VALUES (7, 1, 'guhongpro+')")
        connection.exec_driver_sql("INSERT INTO solves (id, duration_ms, started_at, penalty, user_id, cube_id, custom, scramble) VALUES (?, 12345, '2026-10-04 15:00:00', '+2', 1, 7, 'old tag', 'R U')", (solve_id.hex,))
    command.upgrade(config, "head")
    with engine.connect() as connection:
        assert connection.exec_driver_sql("SELECT cube_id, custom, scramble FROM solves WHERE id = ?",(solve_id.hex,)).one() == (7,'old tag','R U')
        assert connection.exec_driver_sql("SELECT name, catalog_event, catalog_model_id FROM cubes WHERE id = 7").one() == ('guhongpro+',None,None)
        assert connection.exec_driver_sql("PRAGMA foreign_keys").scalar() == 1
        assert connection.exec_driver_sql("PRAGMA foreign_key_check").fetchall() == []
    command.check(config)
    engine.dispose()
