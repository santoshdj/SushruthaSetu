from typing import Annotated

from fastapi import APIRouter, Depends

from app.auth import get_current_user
from app.services import schedule_service

router = APIRouter(prefix="/schedule", tags=["Schedule"])


@router.get("/today")
def get_today_schedule(
    current_user: Annotated[dict, Depends(get_current_user)],
) -> list[dict]:
    role = current_user.get("publicMetadata", {}).get("role", "clinician_user")
    clinician_id = None if role == "clinician_admin" else current_user.get("sub")
    return schedule_service.get_today_schedule(clinician_id=clinician_id)
