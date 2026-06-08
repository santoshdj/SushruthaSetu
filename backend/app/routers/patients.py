from typing import Annotated

from fastapi import APIRouter, Depends

from app.auth import get_current_user
from app.models.patient import PatientCreate, PatientUpdate, PatientResponse, PatientListResponse
from app.services import patient_service
from app.services.audit import post_audit_event

router = APIRouter(prefix="/patients", tags=["Patients"])


@router.get("", response_model=PatientListResponse)
def list_patients(
    name: str | None = None,
    phone: str | None = None,
    page_token: str | None = None,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
) -> PatientListResponse:
    role = (current_user or {}).get("publicMetadata", {}).get("role", "clinician_user")
    clinician_id = None if role == "clinician_admin" else (current_user or {}).get("sub")
    return patient_service.list_patients(name=name, phone=phone, page_token=page_token, clinician_id=clinician_id)


@router.get("/{patient_id}", response_model=PatientResponse)
def get_patient(
    patient_id: str,
    _current_user: Annotated[dict, Depends(get_current_user)] = None,
) -> PatientResponse:
    return patient_service.get_patient(patient_id)


@router.post("", response_model=PatientResponse, status_code=201)
def create_patient(
    data: PatientCreate,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
) -> PatientResponse:
    result = patient_service.create_patient(data, clinician_id=current_user.get("sub", "unknown"))
    patient_name = f"{result.first_name} {result.last_name}".strip() or None
    first = (current_user.get("first_name") or "").strip()
    last = (current_user.get("last_name") or "").strip()
    user_name = f"{first} {last}".strip() or None
    post_audit_event(
        "patient-created",
        user_id=current_user.get("sub", "unknown"),
        patient_id=result.id,
        patient_name=patient_name,
        user_name=user_name,
    )
    return result


@router.put("/{patient_id}", response_model=PatientResponse)
def update_patient(
    patient_id: str,
    data: PatientUpdate,
    current_user: Annotated[dict, Depends(get_current_user)] = None,
) -> PatientResponse:
    result = patient_service.update_patient(patient_id, data)
    patient_name = f"{result.first_name} {result.last_name}".strip() or None
    first = (current_user.get("first_name") or "").strip()
    last = (current_user.get("last_name") or "").strip()
    user_name = f"{first} {last}".strip() or None
    post_audit_event(
        "patient-updated",
        user_id=current_user.get("sub", "unknown"),
        patient_id=patient_id,
        patient_name=patient_name,
        user_name=user_name,
    )
    return result
