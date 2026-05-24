from typing import Annotated

from fastapi import APIRouter, Depends

from app.auth import get_current_user, require_admin
from app.models.patient import PatientCreate, PatientUpdate, PatientResponse, PatientListResponse
from app.services import patient_service

router = APIRouter(prefix="/patients", tags=["Patients"])


@router.get("", response_model=PatientListResponse)
def list_patients(
    name: str | None = None,
    page_token: str | None = None,
    _current_user: Annotated[dict, Depends(get_current_user)] = None,
) -> PatientListResponse:
    return patient_service.list_patients(name=name, page_token=page_token)


@router.post("", response_model=PatientResponse, status_code=201)
def create_patient(
    data: PatientCreate,
    _current_user: Annotated[dict, Depends(require_admin)] = None,
) -> PatientResponse:
    return patient_service.create_patient(data)


@router.put("/{patient_id}", response_model=PatientResponse)
def update_patient(
    patient_id: str,
    data: PatientUpdate,
    _current_user: Annotated[dict, Depends(require_admin)] = None,
) -> PatientResponse:
    return patient_service.update_patient(patient_id, data)
