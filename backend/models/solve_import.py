"""Validated, normalized csTimer records; never accept ownership or solve IDs."""
from datetime import datetime, timezone
from typing import Literal

from pydantic import AwareDatetime, ConfigDict, StrictInt, field_validator, model_validator
from sqlmodel import Field, SQLModel

from backend.models.account import EVENTS
from backend.models.solve import SolveCreate, normalize_custom

IMPORT_BYTES = 10 * 1024 * 1024
IMPORT_RECORDS = 50_000


class ImportSolve(SQLModel):
    model_config = ConfigDict(extra="forbid")
    duration_ms: StrictInt = Field(ge=0, le=9_007_199_254_740_991)
    started_at: AwareDatetime
    penalty: Literal["OK", "+2", "DNF"]

    @field_validator("started_at", mode="before")
    @classmethod
    def timestamp_string(cls, value):
        if not isinstance(value, str):
            raise ValueError("invalid timestamp")
        return value

    @field_validator("started_at")
    @classmethod
    def utc_timestamp(cls, value: datetime):
        value = value.astimezone(timezone.utc)
        if value.year < 1970:
            raise ValueError("invalid timestamp")
        return value


class ImportSession(SQLModel):
    model_config = ConfigDict(extra="forbid")
    event: str = Field(max_length=20)
    cube_name: str | None = Field(default=None, max_length=12)
    cube_model_id: str | None = Field(default=None, max_length=100)
    custom: str | None = Field(default=None, max_length=12)
    solves: list[ImportSolve] = Field(min_length=1, max_length=IMPORT_RECORDS)

    @field_validator("event")
    @classmethod
    def known_event(cls, value):
        if value not in EVENTS:
            raise ValueError("invalid event")
        return value

    @field_validator("cube_name", mode="before")
    @classmethod
    def cube_label(cls, value):
        return SolveCreate.normalize_cube(value)

    @field_validator("custom", mode="before")
    @classmethod
    def custom_tag(cls, value):
        return normalize_custom(value)


class SolveImport(SQLModel):
    model_config = ConfigDict(extra="forbid")
    sessions: list[ImportSession] = Field(min_length=1, max_length=IMPORT_RECORDS)

    @model_validator(mode="after")
    def total_limit(self):
        if sum(len(item.solves) for item in self.sessions) > IMPORT_RECORDS:
            raise ValueError("too many solves")
        return self


class ImportResult(SQLModel):
    imported: int
    skipped: int
