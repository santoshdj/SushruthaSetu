"""
Patient Panel service.

Computes a panel-ready payload for all patients owned by the authenticated
clinician.  Makes 5 targeted FHIR calls per patient (labs, vitals, problems,
immunizations, visit_history), runs existing care-gap rules, derives the
Panel Risk Score, and returns patients sorted High → Medium → Low.
"""

import concurrent.futures
import logging
import re
from datetime import date

from app import fhir_client
from app.services import summary_service
from app.services.patient_service import CLINICIAN_TAG_SYSTEM

logger = logging.getLogger(__name__)

_SORT_ORDER = {"high": 0, "medium": 1, "low": 2}
_MAX_WORKERS = 10
_PANEL_PAGE_SIZE = 200  # fetch all patients in one request for panel view


# ─── Risk helpers (mirror DiseaseControlStatusStrip.tsx thresholds) ──────────

def _days_since(date_str: str) -> int:
    try:
        return (date.today() - date.fromisoformat(date_str[:10])).days
    except (ValueError, TypeError):
        return 9999


def _hba1c_status(labs: list[dict]) -> str:
    """Returns 'red', 'amber', 'green', or 'grey'."""
    entries = sorted(
        [l for l in labs if re.search(r"a1c|hba1c|hemoglobin a1c", (l.get("code") or ""), re.I)],
        key=lambda l: l.get("date", ""),
        reverse=True,
    )
    if not entries:
        return "grey"
    entry = entries[0]
    if _days_since(entry.get("date", "")) > 90:
        return "red"
    val = entry.get("value")
    if val is None:
        return "grey"
    v = float(val)
    if v < 7.0:
        return "green"
    if v <= 8.0:
        return "amber"
    return "red"


def _bp_status(vitals: list[dict]) -> str:
    """Returns 'red', 'amber', 'green', or 'grey'."""
    sys_entries = sorted(
        [v for v in vitals if re.search(r"systolic", (v.get("code") or ""), re.I)],
        key=lambda v: v.get("date", ""),
        reverse=True,
    )
    if not sys_entries:
        return "grey"
    entry = sys_entries[0]
    if _days_since(entry.get("date", "")) > 90:
        return "red"
    val = entry.get("value")
    if val is None:
        return "grey"
    sys_val = float(val)
    if sys_val < 130:
        return "green"
    if sys_val <= 140:
        return "amber"
    return "red"


def _compute_risk_score(hba1c: str, bp: str, care_gaps: list[dict]) -> str:
    """Derive Panel Risk Score from marker statuses and care gap severities."""
    if hba1c == "red" or bp == "red":
        return "high"
    if any(g.get("severity") == "high" for g in care_gaps):
        return "high"
    if hba1c == "amber" or bp == "amber":
        return "medium"
    if any(g.get("severity") == "medium" for g in care_gaps):
        return "medium"
    return "low"


# ─── Per-patient fetcher ──────────────────────────────────────────────────────

def _get_patient_panel_entry(patient_resource: dict) -> dict:
    """Fetch clinical data for one patient and return a panel entry dict."""
    patient_id: str = patient_resource["id"]

    # Name
    official_name = next(
        (n for n in patient_resource.get("name", []) if n.get("use") == "official"),
        patient_resource.get("name", [{}])[0] if patient_resource.get("name") else {},
    )
    given = official_name.get("given", [""])
    name = f"{given[0] if given else ''} {official_name.get('family', '')}".strip()

    # Demographics
    dob: str | None = patient_resource.get("birthDate")
    gender: str = patient_resource.get("gender", "unknown")

    # Follow-up due
    followup_due: str | None = None
    for ext in patient_resource.get("extension", []):
        if ext.get("url") == "patient-mgmt-app/followup-due":
            followup_due = ext.get("valueDate")
            break

    # Clinical data (5 targeted FHIR calls)
    try:
        labs = summary_service._get_labs(patient_id)
        vitals = summary_service._get_vitals(patient_id)
        problems = summary_service._get_problems(patient_id)
        immunizations = summary_service._get_immunizations(patient_id)
        visit_history = summary_service._get_visit_history(patient_id)
    except Exception:
        logger.exception("Failed to fetch clinical data for patient %s", patient_id)
        labs = vitals = problems = immunizations = visit_history = []

    aggregate = {
        "labs": labs,
        "vitals": vitals,
        "problems": problems,
        "immunizations": immunizations,
        "visit_history": visit_history,
    }
    care_gaps = summary_service._run_care_gap_rules(aggregate)

    risk_score = _compute_risk_score(_hba1c_status(labs), _bp_status(vitals), care_gaps)

    return {
        "id": patient_id,
        "name": name,
        "dob": dob,
        "gender": gender,
        "followup_due": followup_due,
        "risk_score": risk_score,
        "open_care_gap_count": len(care_gaps),
        "care_gaps": [
            {"description": g["label"], "severity": g["severity"]}
            for g in care_gaps
        ],
    }


# ─── Public API ───────────────────────────────────────────────────────────────

def get_panel(clinician_id: str | None = None) -> list[dict]:
    """Return sorted panel entries for all patients owned by the clinician."""
    params: dict = {"_count": _PANEL_PAGE_SIZE}
    if clinician_id:
        params["_tag"] = f"{CLINICIAN_TAG_SYSTEM}|{clinician_id}"

    bundle = fhir_client.search_resource("Patient", params)
    patient_resources = [
        e["resource"] for e in bundle.get("entry", []) if "resource" in e
    ]

    if not patient_resources:
        return []

    with concurrent.futures.ThreadPoolExecutor(max_workers=_MAX_WORKERS) as executor:
        results = list(executor.map(_get_patient_panel_entry, patient_resources))

    results.sort(
        key=lambda p: (
            _SORT_ORDER.get(p["risk_score"], 3),
            p["followup_due"] or "9999-99-99",
        )
    )
    return results
