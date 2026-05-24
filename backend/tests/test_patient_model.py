"""Tests for patient model validation."""

import pytest
from datetime import date, timedelta
from pydantic import ValidationError

from app.models.patient import PatientCreate


class TestPatientCreateValidation:
    def test_valid_patient_passes(self):
        p = PatientCreate(
            first_name="Alice",
            last_name="Smith",
            gender="female",
            birth_date=date(1980, 5, 1),
        )
        assert p.first_name == "Alice"

    def test_missing_first_name_raises(self):
        with pytest.raises(ValidationError):
            PatientCreate(last_name="Smith", gender="male", birth_date=date(1980, 1, 1))

    def test_missing_last_name_raises(self):
        with pytest.raises(ValidationError):
            PatientCreate(first_name="Alice", gender="female", birth_date=date(1980, 1, 1))

    def test_blank_first_name_raises(self):
        with pytest.raises(ValidationError):
            PatientCreate(first_name="  ", last_name="Smith", gender="male", birth_date=date(1980, 1, 1))

    def test_future_birth_date_raises(self):
        with pytest.raises(ValidationError):
            PatientCreate(
                first_name="Alice", last_name="Smith",
                gender="female", birth_date=date.today() + timedelta(days=1)
            )

    def test_birth_date_before_1900_raises(self):
        with pytest.raises(ValidationError):
            PatientCreate(
                first_name="Alice", last_name="Smith",
                gender="female", birth_date=date(1899, 12, 31)
            )

    def test_invalid_gender_raises(self):
        with pytest.raises(ValidationError):
            PatientCreate(
                first_name="Alice", last_name="Smith",
                gender="nonbinary", birth_date=date(1980, 1, 1)
            )

    def test_valid_gender_values(self):
        for g in ("male", "female", "other", "unknown"):
            p = PatientCreate(first_name="A", last_name="B", gender=g, birth_date=date(1990, 1, 1))
            assert p.gender == g

    def test_prefix_optional(self):
        p = PatientCreate(first_name="Alice", last_name="Smith", gender="female", birth_date=date(1980, 1, 1))
        assert p.prefix is None

    def test_prefix_max_length_raises(self):
        with pytest.raises(ValidationError):
            PatientCreate(
                first_name="Alice", last_name="Smith", prefix="X" * 21,
                gender="female", birth_date=date(1980, 1, 1)
            )
