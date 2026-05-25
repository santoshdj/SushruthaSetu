"""
Schedule service.
Fetches today's Appointment resources from FHIR.
Falls back to seeded mock data if the FHIR server returns an empty bundle.
"""

import logging
from datetime import date

from app import fhir_client
from app.services.patient_service import CLINICIAN_TAG_SYSTEM

logger = logging.getLogger(__name__)

_MOCK_SCHEDULE = [
    {"id": "appt-1", "patientId": "2d68ad16-268a-478c-1f84-d0f1976e1a46", "patientName": "Mauro Braun", "time": "08:30", "reason": "Annual physical"},
    {"id": "appt-2", "patientId": "46ee9d82-b52c-856d-069b-5064ff052225", "patientName": "Shalanda Treutel", "time": "09:00", "reason": "Hypertension follow-up"},
    {"id": "appt-3", "patientId": "4f083ce3-f12b-bb4b-7353-e17f0cd55b0a", "patientName": "Ezekiel Walter", "time": "09:30", "reason": "Diabetes management"},
    {"id": "appt-4", "patientId": "62f60bdb-cc5c-8305-b98b-f2b229a55eca", "patientName": "Angel Konopelski", "time": "10:00", "reason": "Post-op check"},
    {"id": "appt-5", "patientId": "76b20010-c318-5754-8c85-983aa538522f", "patientName": "Jody Hickle", "time": "10:30", "reason": "New patient visit"},
]


def _get_clinician_patient_ids(clinician_id: str) -> set[str]:
    """Return the set of FHIR Patient IDs owned by a clinician."""
    bundle = fhir_client.search_resource(
        "Patient",
        {"_tag": f"{CLINICIAN_TAG_SYSTEM}|{clinician_id}", "_elements": "id", "_count": 1000},
    )
    return {e["resource"]["id"] for e in bundle.get("entry", []) if "resource" in e}


def get_today_schedule(clinician_id: str | None = None) -> list[dict]:
    today = date.today().isoformat()
    try:
        bundle = fhir_client.search_resource(
            "Appointment",
            {"date": today, "status": "booked", "_count": 50},
        )
        entries = bundle.get("entry", [])
        if not entries:
            logger.info("No FHIR appointments found for %s — using mock schedule", today)
            result = _MOCK_SCHEDULE
            if clinician_id:
                try:
                    owned = _get_clinician_patient_ids(clinician_id)
                    result = [a for a in result if a["patientId"] in owned]
                except Exception:
                    pass
            return result

        appointments = []
        for entry in entries:
            r = entry.get("resource", {})
            participant = next(
                (p for p in r.get("participant", []) if p.get("actor", {}).get("reference", "").startswith("Patient/")),
                None,
            )
            patient_id = participant["actor"]["reference"].split("/")[-1] if participant else ""
            patient_name = participant["actor"].get("display", "Unknown") if participant else "Unknown"
            start = r.get("start", "")
            time_part = start[11:16] if len(start) >= 16 else ""
            reason = r.get("reasonCode", [{}])[0].get("text", "") if r.get("reasonCode") else ""
            appointments.append({
                "id": r.get("id", ""),
                "patientId": patient_id,
                "patientName": patient_name,
                "time": time_part,
                "reason": reason,
            })
        if clinician_id:
            owned = _get_clinician_patient_ids(clinician_id)
            appointments = [a for a in appointments if a["patientId"] in owned]
        return appointments
    except Exception as exc:
        logger.warning("Failed to fetch FHIR appointments (%s) — using mock schedule", exc)
        result = _MOCK_SCHEDULE
        if clinician_id:
            try:
                owned = _get_clinician_patient_ids(clinician_id)
                result = [a for a in result if a["patientId"] in owned]
            except Exception:
                pass
        return result
