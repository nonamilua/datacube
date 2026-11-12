"""Version 1 of the portable datacube JSON format."""
import re
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StrictInt, field_validator, model_validator

UTC_TIMESTAMP = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,6})?(?:Z|\+00:00)")


class BackupCube(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, strict=True)

    handle: str
    catalog_event: str | None
    catalog_model_id: str | None


class BackupSolve(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    id: UUID
    duration_ms: StrictInt = Field(ge=0, le=2**63 - 1)
    started_at: AwareDatetime
    penalty: Literal["OK", "+2", "DNF"]
    custom: str | None = Field(max_length=12)
    scramble: str | None = Field(max_length=4096)
    event_ref: StrictInt | None = Field(ge=0)
    cube_ref: StrictInt | None = Field(ge=0)

    @field_validator("started_at", mode="before")
    @classmethod
    def validate_timestamp(cls, value):
        if not isinstance(value, str):
            return value
        if not UTC_TIMESTAMP.fullmatch(value):
            raise ValueError("expected a UTC timestamp with up to six fractional digits")
        return datetime.fromisoformat(value)


class NativeBackup(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    format: Literal["datacube"]
    version: StrictInt = Field(ge=1, le=1)
    events: list[str]
    cubes: list[BackupCube]
    solves: list[BackupSolve]

    @model_validator(mode="after")
    def validate_references(self):
        if len(set(self.events)) != len(self.events):
            raise ValueError("duplicate event names")
        catalogued = [cube for cube in self.cubes if cube.catalog_event is not None and cube.catalog_model_id is not None]
        if len(set(catalogued)) != len(catalogued):
            raise ValueError("duplicate catalogued cubes")
        ids = set()
        for solve in self.solves:
            if solve.id in ids:
                raise ValueError("duplicate portable solve id")
            ids.add(solve.id)
            if solve.event_ref is not None and solve.event_ref >= len(self.events):
                raise ValueError("invalid event reference")
            if solve.cube_ref is not None and solve.cube_ref >= len(self.cubes):
                raise ValueError("invalid cube reference")
        return self


class RestoreResult(BaseModel):
    imported: int
    skipped: int
