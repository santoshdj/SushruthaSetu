"""
Fire-and-forget FHIR AuditEvent writer.

Calls are non-blocking — each write runs in a daemon thread.
Failures are logged but never surfaced to the caller.
"""

import datetime
import logging
import threading
from typing import Literal

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

AuditEventType = Literal[
    "login",
    "patient-viewed",
    "patient-created",
    "patient-updated",
    "unauthorized-access",
]

_SUBTYPE_DISPLAY: dict[str, str] = {
    "login": "Login",
    "patient-viewed": "Patient Viewed",
    "patient-created": "Patient Created",
    "patient-updated": "Patient Updated",
    "unauthorized-access": "Unauthorized Access Attempt",
}

_ACTION: dict[str, str] = {
    "login": "E",
    "patient-viewed": "R",
    "patient-created": "C",
    "patient-updated": "U",
    "unauthorized-access": "E",
}


def _build_fhir_audit_event(
    event_type: AuditEventType,
    user_id: str,
    patient_id: str | None,
    patient_name: str | None,
    outcome: str,
    user_name: str | None = None,
) -> dict:
    agent: dict = {
        "who": {"display": user_id},
        "requestor": True,
    }
    if user_name:
        agent["name"] = user_name
    resource: dict = {
        "resourceType": "AuditEvent",
        "type": {
            "system": "http://dicom.nema.org/resources/ontology/DCM",
            "code": "110100",
            "display": "Application Activity",
        },
        "subtype": [
            {
                "system": "http://terminology.hl7.org/CodeSystem/audit-event-type",
                "code": event_type,
                "display": _SUBTYPE_DISPLAY[event_type],
            }
        ],
        "action": _ACTION[event_type],
        "recorded": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "outcome": outcome,
        "agent": [agent],
        "source": {
            "observer": {"display": "patient-management-app"},
        },
        "source": {
            "observer": {"display": "patient-management-app"},
        },
    }
    if patient_id:
        resource["entity"] = [
            {
                "what": {
                    "reference": f"Patient/{patient_id}",
                    "display": patient_name or patient_id,
                }
            }
        ]
    return resource


def _post_sync(body: dict) -> None:
    headers = {
        "Accept": "application/fhir+json",
        "Content-Type": "application/fhir+json",
    }
    if settings.fhir_auth_token:
        headers["Authorization"] = f"Bearer {settings.fhir_auth_token}"
    url = f"{settings.fhir_base_url}/AuditEvent"
    try:
        response = httpx.post(url, headers=headers, json=body, timeout=10)
        response.raise_for_status()
        logger.info(
            "AuditEvent posted: %s for user=%s",
            body["subtype"][0]["display"],
            body["agent"][0]["who"]["display"],
        )
    except Exception as exc:
        logger.error("Failed to post AuditEvent: %s", exc)


def post_audit_event(
    event_type: AuditEventType,
    user_id: str,
    patient_id: str | None = None,
    patient_name: str | None = None,
    outcome: str = "0",
    user_name: str | None = None,
) -> None:
    """Schedule an AuditEvent write in a background daemon thread (fire-and-forget)."""
    body = _build_fhir_audit_event(event_type, user_id, patient_id, patient_name, outcome, user_name)
    threading.Thread(target=_post_sync, args=(body,), daemon=True).start()
