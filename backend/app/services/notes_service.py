"""
Visit Notes service.

Reads and writes DocumentReference resources on the FHIR server.
Visit Notes authored by this app are tagged with:
  meta.tag[0] = { system: "patient-mgmt-app", code: "visit-note" }

This distinguishes them from Clinical Notes that originated in the EHR.
"""

import base64
import logging

from app import fhir_client

logger = logging.getLogger(__name__)

_APP_TAG_SYSTEM = "patient-mgmt-app"
_APP_TAG_CODE = "visit-note"
_APP_TAG_CODE_REPORT = "patient-report"


def _get_note_type(doc: dict) -> str:
    """Return 'visit-note', 'patient-report', or 'ehr' based on meta tags."""
    tags = doc.get("meta", {}).get("tag", [])
    for t in tags:
        if t.get("system") == _APP_TAG_SYSTEM:
            code = t.get("code", "")
            if code == _APP_TAG_CODE_REPORT:
                return "patient-report"
            if code == _APP_TAG_CODE:
                return "visit-note"
    return "ehr"


def _decode_text(content_list: list) -> str:
    """Extract plain text from a DocumentReference content array."""
    for item in content_list:
        attachment = item.get("attachment", {})
        data = attachment.get("data")
        if data:
            try:
                return base64.b64decode(data).decode("utf-8")
            except Exception:
                return ""
        url = attachment.get("url")
        if url:
            return url  # external URL — return as-is
    return ""


def _is_app_note(doc: dict) -> bool:
    tags = doc.get("meta", {}).get("tag", [])
    return any(
        t.get("system") == _APP_TAG_SYSTEM and t.get("code") == _APP_TAG_CODE
        for t in tags
    )


def get_notes(patient_id: str) -> list[dict]:
    """
    Fetch all DocumentReference resources for a patient, newest first.
    Returns a list of dicts:
      { id, date, source: "EHR" | "This App", text }
    """
    bundle = fhir_client.search_resource(
        "DocumentReference",
        {"patient": patient_id, "_sort": "-date", "_count": 50},
    )
    entries = bundle.get("entry", [])
    results = []
    for entry in entries:
        doc = entry.get("resource", {})
        if doc.get("resourceType") != "DocumentReference":
            continue
        text = _decode_text(doc.get("content", []))
        if not text:
            continue
        date = (
            doc.get("date")
            or doc.get("context", {}).get("period", {}).get("start", "")
        )
        results.append(
            {
                "id": doc.get("id", ""),
                "date": date,
                "note_type": _get_note_type(doc),
                "source": "This App" if _is_app_note(doc) else "EHR",
                "text": text,
            }
        )
    return results


def create_note(patient_id: str, text: str, encounter_date: str) -> dict:
    """
    POST a new DocumentReference to FHIR representing a Visit Note.
    Returns the created resource dict.
    """
    encoded = base64.b64encode(text.encode("utf-8")).decode("utf-8")
    body = {
        "resourceType": "DocumentReference",
        "meta": {
            "tag": [{"system": _APP_TAG_SYSTEM, "code": _APP_TAG_CODE}]
        },
        "status": "current",
        "type": {
            "coding": [
                {
                    "system": "http://loinc.org",
                    "code": "11506-3",
                    "display": "Progress note",
                }
            ],
            "text": "Progress note",
        },
        "subject": {"reference": f"Patient/{patient_id}"},
        "date": encounter_date,
        "content": [
            {
                "attachment": {
                    "contentType": "text/plain",
                    "data": encoded,
                }
            }
        ],
    }
    created = fhir_client.create_resource("DocumentReference", body)
    return {
        "id": created.get("id", ""),
        "date": encounter_date,
        "note_type": "visit-note",
        "source": "This App",
        "text": text,
    }
