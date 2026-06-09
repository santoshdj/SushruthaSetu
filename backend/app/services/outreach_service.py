"""
Outreach Message service.

Generates a short (1-2 paragraph) AI-written message the clinician can
copy and paste into their external communication tool.  The message is
never saved to FHIR — it is ephemeral.
"""

import logging

import anthropic

from app.config import settings
from app.services import summary_service

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "You are helping a primary care clinician reach out to a patient who has open care items. "
    "Write a short, friendly 1-2 paragraph message the clinician can copy and paste into their "
    "existing patient communication tool. "
    "The message should acknowledge the patient by name, briefly mention the open care items "
    "in plain language (e.g. 'it looks like your blood sugar check is overdue'), "
    "and warmly encourage them to schedule a visit or take the recommended action. "
    "Write at a 6th-grade reading level. Be warm but professional. "
    "Do NOT include specific lab values, medication names, or detailed diagnoses. "
    "Start with 'Dear [Patient Name],' and end with 'Your Care Team'. "
    "Return only the message text — no headers, no markdown, no formatting."
)


def generate_outreach_message(patient_id: str) -> str:
    """Call Claude to produce an outreach message. Returns plain text."""
    aggregate = summary_service.get_patient_summary(patient_id)
    patient_name = aggregate.get("patient_name", "Patient")
    care_gaps = aggregate.get("care_gaps", [])

    if care_gaps:
        gap_text = "; ".join(g["label"] for g in care_gaps)
    else:
        gap_text = "a routine preventive care check-in"

    user_message = (
        f"Patient name: {patient_name}\n"
        f"Open care items: {gap_text}\n\n"
        "Please write the outreach message."
    )

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    message = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=512,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )
    return message.content[0].text.strip()
