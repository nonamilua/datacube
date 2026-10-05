from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, ConfigDict, StrictInt, field_validator
from sqlalchemy import CheckConstraint, Column, DateTime
from sqlmodel import Field, SQLModel


class SolveCreate(SQLModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    duration_ms: StrictInt = Field(ge=0)
    started_at: AwareDatetime
    penalty: Literal["OK", "+2", "DNF"] = "OK"

    @field_validator("started_at")
    @classmethod
    def normalize_utc(cls, value: datetime) -> datetime:
        return value.astimezone(timezone.utc)


class Solve(SQLModel, table=True):
    __tablename__ = "solves"
    __table_args__ = (
        CheckConstraint("duration_ms >= 0", name="ck_solve_duration"),
        CheckConstraint("penalty IN ('OK', '+2', 'DNF')", name="ck_solve_penalty"),
    )
    id: UUID = Field(primary_key=True)
    duration_ms: int
    started_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False, index=True))
    penalty: str = "OK"


class SolveRead(SQLModel):
    id: UUID
    duration_ms: int
    started_at: datetime
    penalty: Literal["OK", "+2", "DNF"]

    @field_validator("started_at")
    @classmethod
    def restore_utc(cls, value: datetime) -> datetime:
        # SQLite drops timezone information; all stored values are UTC.
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


class SolvePage(SQLModel):
    items: list[SolveRead]
    total: int
