from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.auth import get_current_user
from app.services import notes_service

router = APIRouter(prefix="/patients", tags=["Notes"])


class NoteCreate(BaseModel):
    text: str
    encounter_date: str  # ISO-8601 datetime string


@router.get("/{patient_id}/notes")
def get_notes(
    patient_id: str,
    _current_user: Annotated[dict, Depends(get_current_user)],
) -> list[dict]:
    return notes_service.get_notes(patient_id)


@router.post("/{patient_id}/notes", status_code=201)
def create_note(
    patient_id: str,
    body: NoteCreate,
    _current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    if not body.text.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Note text cannot be empty")
    return notes_service.create_note(patient_id, body.text.strip(), body.encounter_date)
