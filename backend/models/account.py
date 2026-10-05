from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, UniqueConstraint
from sqlmodel import Field, SQLModel

EVENTS = ["3x3", "2x2", "4x4", "5x5", "6x6", "7x7", "3bld", "3oh", "clock", "megaminx", "pyraminx", "skewb", "square 1", "4bld", "5bld", "3mbld", "fmc", "fto"]


class User(SQLModel, table=True):
    __tablename__ = "users"
    id: int | None = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    password_hash: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False))


class LoginSession(SQLModel, table=True):
    __tablename__ = "login_sessions"
    token_hash: str = Field(primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    expires_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))


class Cube(SQLModel, table=True):
    __tablename__ = "cubes"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_cube_user_name"),)
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    name: str


class Category(SQLModel, table=True):
    __tablename__ = "categories"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_category_user_name"),)
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    name: str
