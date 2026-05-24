"""
Pre-visit AI summary service.
Calls Anthropic Claude to generate a concise pre-visit narrative from the patient aggregate.
"""

import json
import logging

import anthropic

from app.config import settings

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "You are a clinical decision support tool. Given structured patient data, "
    "produce a concise pre-visit summary for the clinician. "
    "Return ONLY a valid JSON array of 6-8 strings. Each string is one self-contained bullet point. "
    "Focus on: active clinical concerns, recent changes, pending items, and care gaps. "
    "Be precise and factual. Do not speculate beyond the provided data. "
    "Do not include any text, markdown, or explanation outside the JSON array."
)


def generate_pre_visit_summary(aggregate: dict) -> dict:
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    patient_name = aggregate.get("patient_name") or f"Patient {aggregate['patient_id']}"

    problems_text = ", ".join(p["code"] for p in aggregate.get("problems", []) if p.get("code")) or "None documented"
    meds_text = ", ".join(m["medication"] for m in aggregate.get("medications", []) if m.get("medication")) or "None documented"
    allergies_text = ", ".join(a["substance"] for a in aggregate.get("allergies", []) if a.get("substance")) or "None documented"
    labs_text = "; ".join(
        f"{l['code']}: {l['value']} {l['unit']} ({l['date'][:10]})"
        for l in aggregate.get("labs", [])[:5]
        if l.get("code") and l.get("value")
    ) or "None recent"
    vitals_text = "; ".join(
        f"{v['code']}: {v['value']} {v['unit']}"
        for v in aggregate.get("vitals", [])[:5]
        if v.get("code") and v.get("value")
    ) or "None recent"
    gaps_text = "; ".join(
        f"{g['label']} ({g['severity']}): {g['rationale']}"
        for g in aggregate.get("care_gaps", [])
    ) or "None identified"
    last_visit = aggregate.get("visit_history", [{}])[0].get("date", "Unknown")[:10] if aggregate.get("visit_history") else "Unknown"

    user_message = f"""Patient: {patient_name}

Active problems: {problems_text}
Current medications: {meds_text}
Allergies: {allergies_text}
Recent vitals: {vitals_text}
Recent labs: {labs_text}
Last visit: {last_visit}
Care gaps: {gaps_text}

Please generate a pre-visit summary for the clinician."""

    message = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=512,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )
    raw = message.content[0].text.strip()
    # Strip markdown code fences that the model sometimes wraps around JSON
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1]  # drop opening ```json line
        raw = raw.rsplit("```", 1)[0].strip()  # drop closing ```
    try:
        bullets = json.loads(raw)
        if not isinstance(bullets, list):
            bullets = [raw]
    except json.JSONDecodeError:
        # Fallback: split on newlines, strip common bullet prefixes
        bullets = [line.lstrip("\u2022-* ").strip() for line in raw.split("\n") if line.strip()]
    return {"patient_name": patient_name, "bullets": bullets}
