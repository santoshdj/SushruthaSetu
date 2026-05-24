"""Shared test fixtures."""

import pytest
from fastapi.testclient import TestClient

from main import app
from app.auth import get_current_user, require_admin


def _make_clinician_user():
    return {"sub": "user_clinician", "publicMetadata": {"role": "clinician"}}


def _make_admin_user():
    return {"sub": "user_admin", "publicMetadata": {"role": "admin"}}


@pytest.fixture
def client_clinician():
    app.dependency_overrides[get_current_user] = _make_clinician_user
    app.dependency_overrides[require_admin] = lambda: (_ for _ in ()).throw(
        __import__("fastapi").HTTPException(status_code=403, detail="Admin access required")
    )
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def client_admin():
    app.dependency_overrides[get_current_user] = _make_admin_user
    app.dependency_overrides[require_admin] = _make_admin_user
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
