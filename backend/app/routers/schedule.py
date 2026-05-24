from typing import Annotated

from fastapi import APIRouter, Depends

from app.auth import get_current_user
from app.services import schedule_service

router = APIRouter(prefix="/schedule", tags=["Schedule"])


@router.get("/today")
def get_today_schedule(
    _current_user: Annotated[dict, Depends(get_current_user)],
) -> list[dict]:
    return schedule_service.get_today_schedule()
