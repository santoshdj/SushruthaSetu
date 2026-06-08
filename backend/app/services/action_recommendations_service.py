"""
Action Recommendations service.

Given the current visit note text, the patient aggregate, and up to 5 previous
visit notes, calls Claude to produce categorised clinical next-step suggestions.

Output shape per suggestion:
  { category, action, urgency, rationale, guideline_citation }

Valid categories: Medications, Lab Tests, Referrals, Follow-up, Patient Education
Valid urgency:    routine, urgent, critical
guideline_citation: { source, text } — the clinical guideline justifying the suggestion (e.g. ADA 2024, AHA/ACC 2017). Omit if no specific guideline applies.
"""

import json
import logging

import anthropic

from app.config import settings
from app.services import summary_service, notes_service

logger = logging.getLogger(__name__)

_PREVIOUS_NOTES_LIMIT = 5

_SYSTEM_PROMPT = (
    "You are a clinical decision support tool embedded in a physician's patient management app. "
    "You will be given: (1) the transcript of the current visit conversation, "
    "(2) the patient's existing clinical data (problems, medications, allergies, vitals, labs, care gaps), "
    "and (3) notes from previous visits for longitudinal context. "
    "Based on all of this, produce a list of specific, actionable next steps for the clinician. "
    "Return ONLY a valid JSON array. Each element must be an object with exactly these keys: "
    "\"category\" (one of: Medications, Lab Tests, Referrals, Follow-up, Patient Education), "
    "\"action\" (a concise imperative string, e.g. \"Order HbA1c\"), "
    "\"urgency\" (one of: routine, urgent, critical), "
    ""rationale" (one sentence explaining why, grounded in the provided data), "
    "\"guideline_citation\" (optional object with \"source\" and \"text\" fields citing the specific clinical guideline — e.g. ADA 2024, AHA/ACC 2017 — that justifies this recommendation; omit the key if no guideline applies). "
    "Do NOT suggest anything the patient is already receiving per their current medications or existing orders. "
    "Do NOT include any text, markdown, or explanation outside the JSON array. "
    "Produce 4-8 suggestions."
)


def generate_action_recommendations(patient_id: str, note_text: str) -> dict:
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    # Fetch patient aggregate
    aggregate = summary_service.get_patient_summary(patient_id)
    patient_name = aggregate.get("patient_name") or f"Patient {patient_id}"

    # Fetch previous notes (longitudinal context, capped at limit)
    all_notes = notes_service.get_notes(patient_id)
    previous_notes = all_notes[:_PREVIOUS_NOTES_LIMIT]

    # Build aggregate context
    problems_text = ", ".join(
        p["code"] for p in aggregate.get("problems", []) if p.get("code")
    ) or "None documented"
    meds_text = ", ".join(
        m["medication"] for m in aggregate.get("medications", []) if m.get("medication")
    ) or "None documented"
    allergies_text = ", ".join(
        a["substance"] for a in aggregate.get("allergies", []) if a.get("substance")
    ) or "None documented"
    vitals_text = "; ".join(
        f"{v['code']}: {v['value']} {v['unit']}"
        for v in aggregate.get("vitals", [])[:5]
        if v.get("code") and v.get("value")
    ) or "None recent"
    labs_text = "; ".join(
        f"{l['code']}: {l['value']} {l['unit']} ({l['date'][:10]})"
        for l in aggregate.get("labs", [])[:5]
        if l.get("code") and l.get("value")
    ) or "None recent"
    gaps_text = "; ".join(
        f"{g['label']} ({g['severity']}): {g['rationale']}"
        for g in aggregate.get("care_gaps", [])
    ) or "None identified"

    # Build previous notes context
    if previous_notes:
        notes_lines = []
        for n in previous_notes:
            date_str = n.get("date", "")[:10] if n.get("date") else "unknown date"
            source = n.get("source", "EHR")
            text = n.get("text", "").strip()
            notes_lines.append(f"[{date_str} | {source}] {text}")
        previous_notes_text = "\n\n".join(notes_lines)
    else:
        previous_notes_text = "No previous notes on record."

    user_message = f"""Patient: {patient_name}

--- CURRENT VISIT NOTE ---
{note_text.strip()}

--- EXISTING CLINICAL DATA ---
Active problems: {problems_text}
Current medications: {meds_text}
Allergies: {allergies_text}
Recent vitals: {vitals_text}
Recent labs: {labs_text}
Care gaps: {gaps_text}

--- PREVIOUS VISIT NOTES (newest first) ---
{previous_notes_text}

Please generate action recommendations for the clinician based on the above."""

    message = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=1024,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    raw = message.content[0].text.strip()
    # Strip markdown code fences
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1]
        raw = raw.rsplit("```", 1)[0].strip()

    try:
        recommendations = json.loads(raw)
        if not isinstance(recommendations, list):
            recommendations = []
    except json.JSONDecodeError:
        logger.warning("Failed to parse action recommendations JSON: %s", raw[:200])
        recommendations = []

    return {"recommendations": recommendations}
