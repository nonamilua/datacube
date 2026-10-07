from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, ConfigDict, StrictInt, field_validator
from sqlalchemy import CheckConstraint, Column, DateTime, Text
from sqlmodel import Field, SQLModel


class SolveCreate(SQLModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    duration_ms: StrictInt = Field(ge=0)
    started_at: AwareDatetime
    penalty: Literal["OK", "+2", "DNF"] = "OK"
    category_id: int | None = None
    cube_name: str | None = Field(default=None, max_length=10)
    # Room for long big-cube notation; preserve case, punctuation and whitespace.
    scramble: str | None = Field(default=None, max_length=4096)

    @field_validator("scramble")
    @classmethod
    def validate_scramble(cls, value):
        if value is not None:
            if not value.strip() or any(ord(character) < 32 and character not in "\n\r\t" or ord(character) == 127 for character in value):
                raise ValueError("scramble must be nonempty plain text")
        return value

    @field_validator("cube_name", mode="before")
    @classmethod
    def normalize_cube(cls, value):
        if isinstance(value, str):
            if any(ord(character) < 32 or ord(character) == 127 for character in value):
                raise ValueError("cube must be plain text")
            return value.strip().lower()[:10] or None
        return value

    @field_validator("started_at")
    @classmethod
    def normalize_utc(cls, value: datetime) -> datetime:
        return value.astimezone(timezone.utc)


class SolveUpdate(SQLModel):
    model_config = ConfigDict(extra="forbid")
    penalty: Literal["OK", "+2", "DNF"]
    custom: str | None = Field(default=None, max_length=10)

    @field_validator("custom", mode="before")
    @classmethod
    def normalize_custom(cls, value):
        if isinstance(value, str):
            if any(ord(character) < 32 or ord(character) == 127 for character in value):
                raise ValueError("custom must be plain text")
            return value.strip().lower()[:10] or None
        return value


class Solve(SQLModel, table=True):
    __tablename__ = "solves"
    __table_args__ = (
        CheckConstraint("duration_ms >= 0", name="ck_solve_duration"),
        CheckConstraint("penalty IN ('OK', '+2', 'DNF')", name="ck_solve_penalty"),
        CheckConstraint("custom IS NULL OR length(custom) <= 10", name="ck_solve_custom_length"),
        CheckConstraint("scramble IS NULL OR length(scramble) <= 4096", name="ck_solve_scramble_length"),
    )
    id: UUID = Field(primary_key=True)
    duration_ms: int
    started_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False, index=True))
    penalty: str = "OK"
    user_id: int | None = Field(default=None, foreign_key="users.id", index=True)
    cube_id: int | None = Field(default=None, foreign_key="cubes.id")
    category_id: int | None = Field(default=None, foreign_key="categories.id")
    custom: str | None = Field(default=None, max_length=10)
    scramble: str | None = Field(default=None, sa_column=Column(Text, nullable=True))


class SolveRead(SQLModel):
    id: UUID
    duration_ms: int
    started_at: datetime
    penalty: Literal["OK", "+2", "DNF"]
    cube_id: int | None = None
    category_id: int | None = None
    custom: str | None = None
    scramble: str | None = None

    @field_validator("started_at")
    @classmethod
    def restore_utc(cls, value: datetime) -> datetime:
        # SQLite drops timezone information; all stored values are UTC.
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


class SolvePage(SQLModel):
    items: list[SolveRead]
    total: int
