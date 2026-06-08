"""
Post-Visit Patient Report service.

Generates a plain-language after-visit summary for the patient using Claude,
then saves it as a FHIR DocumentReference tagged with:
  meta.tag = { system: "patient-mgmt-app", code: "patient-report" }
  type.coding = LOINC 34133-9 (Summarization of episode note)
"""

import base64
import datetime
import logging

import anthropic

from app import fhir_client
from app.config import settings
from app.services import summary_service

logger = logging.getLogger(__name__)

_APP_TAG_SYSTEM = "patient-mgmt-app"
_APP_TAG_CODE = "patient-report"

_SYSTEM_PROMPT = (
    "You are helping a clinician create a plain-language after-visit summary for their patient. "
    "Convert the clinical visit note into a friendly, easy-to-understand summary. "
    "Write at a 6th-grade reading level. Address the patient directly using 'you' and 'your'. "
    "Use 3–5 short paragraphs covering: "
    "(1) What we discussed today, "
    "(2) What was ordered or changed (medications, tests, referrals), "
    "(3) What you should do before your next visit. "
    "If a follow-up date is provided, mention it in the last paragraph. "
    "Avoid clinical jargon. Do not use bullet lists or markdown. "
    "Return only the plain-text summary — no headers, no formatting."
)


def generate_patient_report(
    patient_id: str,
    note_text: str,
    followup_date: str | None = None,
) -> str:
    """Call Claude to produce a patient-friendly visit summary. Returns plain text."""
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    aggregate = summary_service.get_patient_summary(patient_id)
    meds_text = ", ".join(
        m["medication"] for m in aggregate.get("medications", []) if m.get("medication")
    ) or "none"
    problems_text = ", ".join(
        p["code"] for p in aggregate.get("problems", []) if p.get("code")
    ) or "none"

    followup_line = f"\nFollow-up appointment: {followup_date}" if followup_date else ""

    user_message = (
        f"Visit note (written by clinician):\n{note_text.strip()}\n\n"
        f"Patient's active problems: {problems_text}\n"
        f"Current medications: {meds_text}"
        f"{followup_line}\n\n"
        "Please write the after-visit patient summary."
    )

    message = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=1024,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    return message.content[0].text.strip()


def save_patient_report(patient_id: str, text: str) -> dict:
    """Save an after-visit patient report as a FHIR DocumentReference."""
    encoded = base64.b64encode(text.encode("utf-8")).decode("utf-8")
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

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
                    "code": "34133-9",
                    "display": "Summarization of episode note",
                }
            ],
            "text": "After-visit patient summary",
        },
        "subject": {"reference": f"Patient/{patient_id}"},
        "date": now,
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
        "date": now,
        "note_type": _APP_TAG_CODE,
        "source": "This App",
        "text": text,
    }
