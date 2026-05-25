"""
Audit Event endpoints.

POST /audit  — called by the frontend once per login session.
GET  /audit  — returns a transformed list for the Events Page.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.auth import get_current_user
from app.fhir_client import search_resource
from app.services.audit import post_audit_event

router = APIRouter(prefix="/audit", tags=["Audit"])


def _transform(resource: dict) -> dict:
    outcome_raw = resource.get("outcome", "0")
    outcome = "Success" if outcome_raw == "0" else "Failure"
    entity = (resource.get("entity") or [{}])[0].get("what", {})
    return {
        "id": resource.get("id"),
        "timestamp": resource.get("recorded"),
        "event_type": (resource.get("subtype") or [{}])[0].get("display", ""),
        "user": (resource.get("agent") or [{}])[0].get("who", {}).get("display", "unknown"),
        "patient": entity.get("display") or None,
        "outcome": outcome,
    }


@router.post("", status_code=201)
def record_login(
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    user_id = current_user.get("sub", "unknown")
    post_audit_event("login", user_id=user_id, outcome="0")
    return {"status": "recorded"}


@router.get("")
def list_audit_events(
    event_type: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    _current_user: Annotated[dict, Depends(get_current_user)] = None,
) -> list[dict]:
    params: dict = {"_sort": "-date", "_count": "200"}
    if event_type:
        params["subtype"] = event_type
    date_filters = []
    if date_from:
        date_filters.append(f"ge{date_from}")
    if date_to:
        date_filters.append(f"le{date_to}")
    if date_filters:
        params["date"] = date_filters if len(date_filters) > 1 else date_filters[0]
    bundle = search_resource("AuditEvent", params)
    return [_transform(e["resource"]) for e in bundle.get("entry", []) if "resource" in e]
