"""Tests for JWT auth middleware and require_admin dependency."""

from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient

from main import app
from app.auth import get_current_user, require_admin


class TestGetCurrentUser:
    def test_valid_admin_jwt_passes(self, client_admin):
        response = client_admin.get("/schedule/today")
        assert response.status_code == 200

    def test_valid_clinician_jwt_passes(self, client_clinician):
        response = client_clinician.get("/schedule/today")
        assert response.status_code == 200

    def test_missing_auth_header_returns_401(self):
        with TestClient(app) as client:
            response = client.get("/schedule/today")
        assert response.status_code in (401, 403)


class TestRequireAdmin:
    def test_admin_can_create_patient(self, client_admin):
        with patch("app.services.patient_service.create_patient") as mock_create:
            mock_create.return_value = MagicMock(
                id="new-id", first_name="Jane", last_name="Doe",
                prefix=None, gender="female", birth_date="1985-06-15",
                model_dump=lambda: {
                    "id": "new-id", "first_name": "Jane", "last_name": "Doe",
                    "prefix": None, "gender": "female", "birth_date": "1985-06-15"
                }
            )
            response = client_admin.post("/patients", json={
                "first_name": "Jane", "last_name": "Doe",
                "gender": "female", "birth_date": "1985-06-15"
            })
        assert response.status_code in (200, 201)

    def test_clinician_cannot_create_patient_returns_403(self, client_clinician):
        response = client_clinician.post("/patients", json={
            "first_name": "Jane", "last_name": "Doe",
            "gender": "female", "birth_date": "1985-06-15"
        })
        assert response.status_code == 403

    def test_clinician_cannot_update_patient_returns_403(self, client_clinician):
        response = client_clinician.put("/patients/patient-1", json={
            "first_name": "Jane", "last_name": "Doe",
            "gender": "female", "birth_date": "1985-06-15"
        })
        assert response.status_code == 403
