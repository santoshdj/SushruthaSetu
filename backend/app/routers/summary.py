from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth import get_current_user
from app.services import summary_service, ai_summary_service, action_recommendations_service
from app.services.audit import post_audit_event

router = APIRouter(prefix="/patients", tags=["Summary"])


@router.get("/{patient_id}/summary")
def get_patient_summary(
    patient_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    summary = summary_service.get_patient_summary(patient_id)
    p = summary.get("patient_profile", {})
    patient_name = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip() or None
    post_audit_event(
        "patient-viewed",
        user_id=current_user.get("sub", "unknown"),
        patient_id=patient_id,
        patient_name=patient_name,
    )
    return summary


@router.get("/{patient_id}/ai-summary")
def get_ai_summary(
    patient_id: str,
    _current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    aggregate = summary_service.get_patient_summary(patient_id)
    return ai_summary_service.generate_pre_visit_summary(aggregate)


class ActionRecommendationsRequest(BaseModel):
    note_text: str


@router.post("/{patient_id}/action-recommendations")
def get_action_recommendations(
    patient_id: str,
    body: ActionRecommendationsRequest,
    _current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    return action_recommendations_service.generate_action_recommendations(
        patient_id, body.note_text
    )
