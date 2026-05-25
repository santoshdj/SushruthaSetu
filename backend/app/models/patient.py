from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, field_validator


class PatientAddress(BaseModel):
    line: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    country: str | None = None


class PatientBase(BaseModel):
    first_name: str
    last_name: str
    prefix: str | None = None
    gender: Literal["male", "female", "other", "unknown"]
    birth_date: date
    # Contact
    phone: str | None = None
    address: PatientAddress | None = None
    # Demographics
    marital_status: str | None = None
    multiple_birth: bool | None = None
    language: str | None = None
    mothers_maiden_name: str | None = None
    birth_place: str | None = None
    # US Core Clinical
    race: str | None = None
    ethnicity: str | None = None
    birth_sex: str | None = None

    @field_validator("first_name", "last_name")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Field cannot be blank")
        if len(v) > 100:
            raise ValueError("Field cannot exceed 100 characters")
        return v.strip()

    @field_validator("prefix")
    @classmethod
    def prefix_max_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 20:
            raise ValueError("Prefix cannot exceed 20 characters")
        return v

    @field_validator("birth_date")
    @classmethod
    def birth_date_valid(cls, v: date) -> date:
        today = date.today()
        if v > today:
            raise ValueError("Date of birth cannot be in the future")
        if v < date(1900, 1, 1):
            raise ValueError("Date of birth cannot be before 1900-01-01")
        return v


class PatientCreate(PatientBase):
    pass


class PatientUpdate(PatientBase):
    pass


class PatientResponse(BaseModel):
    id: str
    first_name: str
    last_name: str
    prefix: str | None = None
    gender: str
    birth_date: str
    # Contact
    phone: str | None = None
    address: PatientAddress | None = None
    # Demographics
    marital_status: str | None = None
    multiple_birth: bool | None = None
    language: str | None = None
    mothers_maiden_name: str | None = None
    birth_place: str | None = None
    # US Core Clinical
    race: str | None = None
    ethnicity: str | None = None
    birth_sex: str | None = None


class PatientListResponse(BaseModel):
    patients: list[PatientResponse]
    next_page_token: str | None = None
    previous_page_token: str | None = None
