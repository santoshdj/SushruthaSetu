"""
Patient summary service.
Fetches all seven clinical data sections from FHIR for a given patient ID.
Runs care gap rules against the aggregate.
"""

import asyncio
import logging
from datetime import date, timedelta

from app import fhir_client

logger = logging.getLogger(__name__)

_COMPLETION_FIELDS: list[tuple[str, str]] = [
    ("first_name", "First name"),
    ("last_name", "Last name"),
    ("prefix", "Name prefix"),
    ("gender", "Gender"),
    ("birth_date", "Date of birth"),
    ("phone", "Phone number"),
    ("address", "Address"),
    ("marital_status", "Marital status"),
    ("language", "Communication language"),
    ("multiple_birth", "Multiple birth status"),
    ("race", "Race"),
    ("ethnicity", "Ethnicity"),
    ("birth_sex", "Birth sex"),
    ("mothers_maiden_name", "Mother's maiden name"),
    ("birth_place", "Birth place"),
]


def _get_profile_completeness(patient: dict) -> dict:
    official_name = next(
        (n for n in patient.get("name", []) if n.get("use") == "official"),
        patient.get("name", [{}])[0] if patient.get("name") else {},
    )
    ext_urls = {e["url"] for e in patient.get("extension", [])}

    checks: dict[str, bool] = {
        "first_name": bool(official_name.get("given")),
        "last_name": bool(official_name.get("family")),
        "prefix": bool(official_name.get("prefix")),
        "gender": bool(patient.get("gender")),
        "birth_date": bool(patient.get("birthDate")),
        "phone": bool(patient.get("telecom")),
        "address": bool(patient.get("address")),
        "marital_status": bool(patient.get("maritalStatus")),
        "language": bool(patient.get("communication")),
        "multiple_birth": patient.get("multipleBirthBoolean") is not None,
        "race": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race" in ext_urls,
        "ethnicity": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity" in ext_urls,
        "birth_sex": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex" in ext_urls,
        "mothers_maiden_name": "http://hl7.org/fhir/StructureDefinition/patient-mothersMaidenName" in ext_urls,
        "birth_place": "http://hl7.org/fhir/StructureDefinition/patient-birthPlace" in ext_urls,
    }

    label_map = dict(_COMPLETION_FIELDS)
    present = [label_map[k] for k, v in checks.items() if v]
    missing = [label_map[k] for k, v in checks.items() if not v]
    score = round(len(present) / len(checks), 2)
    return {"score": score, "missing": missing, "present": present}


def _extract_entries(bundle: dict) -> list[dict]:
    return [e["resource"] for e in bundle.get("entry", []) if "resource" in e]


def _get_problems(patient_id: str) -> list[dict]:
    bundle = fhir_client.search_resource(
        "Condition",
        {"patient": patient_id, "clinical-status": "active", "_count": 50},
    )
    return [
        {
            "code": c.get("code", {}).get("text", ""),
            "onset": c.get("onsetDateTime", ""),
            "status": c.get("clinicalStatus", {}).get("coding", [{}])[0].get("code", ""),
        }
        for c in _extract_entries(bundle)
    ]


def _get_medications(patient_id: str) -> list[dict]:
    bundle = fhir_client.search_resource(
        "MedicationRequest",
        {"patient": patient_id, "status": "active", "_count": 50},
    )
    return [
        {
            "medication": m.get("medicationCodeableConcept", {}).get("text", ""),
            "dosage": m.get("dosageInstruction", [{}])[0].get("text", "") if m.get("dosageInstruction") else "",
            "authoredOn": m.get("authoredOn", ""),
        }
        for m in _extract_entries(bundle)
    ]


def _get_allergies(patient_id: str) -> list[dict]:
    bundle = fhir_client.search_resource(
        "AllergyIntolerance",
        {"patient": patient_id, "_count": 50},
    )
    return [
        {
            "substance": a.get("code", {}).get("text", ""),
            "criticality": a.get("criticality", ""),
            "reaction": a.get("reaction", [{}])[0].get("description", "") if a.get("reaction") else "",
        }
        for a in _extract_entries(bundle)
    ]


# Adult reference ranges keyed by lowercase substring of the vital code text.
# Tuple: (low, high).  Only used for display — clinical flagging uses FHIR interpretation.
_VITAL_RANGES: list[tuple[str, float, float]] = [
    ("systolic blood pressure", 90.0, 120.0),
    ("diastolic blood pressure", 60.0, 80.0),
    ("heart rate", 60.0, 100.0),
    ("respiratory rate", 12.0, 20.0),
    ("body temperature", 36.1, 37.2),
    ("body mass index (bmi) [ratio]", 18.5, 24.9),
    ("oxygen saturation", 95.0, 100.0),
    ("systolic", 90.0, 120.0),
    ("diastolic", 60.0, 80.0),
]


def _get_vital_range(code: str) -> dict | None:
    code_lower = code.lower()
    for key, low, high in _VITAL_RANGES:
        if key in code_lower:
            return {"low": low, "high": high}
    return None


def _parse_vitals_bundle(bundle: dict, *, dedup: bool) -> list[dict]:
    """Parse a vital-signs Observation bundle into a flat list of reading dicts.

    When *dedup* is True only the most-recent reading per vital code is kept
    (nurse check-in view).  When False every reading is returned (trend view).
    """
    seen_codes: set[str] = set()
    result: list[dict] = []
    for o in _extract_entries(bundle):
        obs_date = o.get("effectiveDateTime", "")
        # Panel observation — expand components (e.g. blood pressure systolic/diastolic)
        if o.get("component"):
            for comp in o["component"]:
                code = comp.get("code", {}).get("text", "")
                if not code:
                    continue
                if dedup and code in seen_codes:
                    continue
                seen_codes.add(code)
                vq = comp.get("valueQuantity", {})
                entry: dict = {"code": code, "value": vq.get("value"), "unit": vq.get("unit", ""), "date": obs_date}
                ref = _get_vital_range(code)
                if ref:
                    entry["reference_range"] = ref
                result.append(entry)
            continue
        code = o.get("code", {}).get("text", "")
        if not code:
            continue
        if dedup and code in seen_codes:
            continue
        # Scalar observation — valueQuantity or valueInteger
        vq = o.get("valueQuantity")
        vi = o.get("valueInteger")
        if vq is not None:
            value = vq.get("value")
            unit = vq.get("unit", "")
        elif vi is not None:
            value = vi
            unit = ""
        else:
            continue  # no scalar value — skip
        seen_codes.add(code)
        entry = {"code": code, "value": value, "unit": unit, "date": obs_date}
        ref = _get_vital_range(code)
        if ref:
            entry["reference_range"] = ref
        result.append(entry)
    return result


def _get_vitals(patient_id: str) -> list[dict]:
    """Latest single reading per vital type — used for the check-in panel on the patient hub."""
    bundle = fhir_client.search_resource(
        "Observation",
        {"patient": patient_id, "category": "vital-signs", "_sort": "-date", "_count": 50},
    )
    return _parse_vitals_bundle(bundle, dedup=True)


def get_vitals_history(patient_id: str) -> list[dict]:
    """All vital-sign readings without deduplication — used for the trend/history page."""
    bundle = fhir_client.search_resource(
        "Observation",
        {"patient": patient_id, "category": "vital-signs", "_sort": "-date", "_count": 100},
    )
    return _parse_vitals_bundle(bundle, dedup=False)


def _get_labs(patient_id: str) -> list[dict]:
    bundle = fhir_client.search_resource(
        "Observation",
        {"patient": patient_id, "category": "laboratory", "_sort": "-date", "_count": 30},
    )
    result = []
    for o in _extract_entries(bundle):
        rr_list = o.get("referenceRange", [])
        rr = rr_list[0] if rr_list else {}
        ref_low = rr.get("low", {}).get("value") if rr else None
        ref_high = rr.get("high", {}).get("value") if rr else None
        entry: dict = {
            "code": o.get("code", {}).get("text", ""),
            "value": o.get("valueQuantity", {}).get("value"),
            "unit": o.get("valueQuantity", {}).get("unit", ""),
            "date": o.get("effectiveDateTime", ""),
            "interpretation": o.get("interpretation", [{}])[0].get("coding", [{}])[0].get("code", "") if o.get("interpretation") else "",
        }
        if ref_low is not None or ref_high is not None:
            entry["reference_range"] = {"low": ref_low, "high": ref_high}
        result.append(entry)
    return result


def _get_visit_history(patient_id: str) -> list[dict]:
    bundle = fhir_client.search_resource(
        "Encounter",
        {"patient": patient_id, "_sort": "-date", "_count": 10},
    )
    return [
        {
            "type": e.get("type", [{}])[0].get("text", "") if e.get("type") else "",
            "date": e.get("period", {}).get("start", ""),
            "status": e.get("status", ""),
            "reason": e.get("reasonCode", [{}])[0].get("text", "") if e.get("reasonCode") else "",
        }
        for e in _extract_entries(bundle)
    ]


def _get_immunizations(patient_id: str) -> list[dict]:
    bundle = fhir_client.search_resource(
        "Immunization",
        {"patient": patient_id, "_count": 50},
    )
    return [
        {
            "vaccine": i.get("vaccineCode", {}).get("text", ""),
            "date": i.get("occurrenceDateTime", ""),
            "status": i.get("status", ""),
        }
        for i in _extract_entries(bundle)
    ]


def _run_care_gap_rules(aggregate: dict) -> list[dict]:
    gaps = []
    today = date.today()

    # Rule 1: HbA1c overdue (diabetic patients, no result in 90 days)
    is_diabetic = any("diabet" in (p.get("code") or "").lower() for p in aggregate["problems"])
    if is_diabetic:
        hba1c_labs = [
            l for l in aggregate["labs"]
            if "a1c" in (l.get("code") or "").lower() or "hba1c" in (l.get("code") or "").lower()
        ]
        if not hba1c_labs or (today - date.fromisoformat(hba1c_labs[0]["date"][:10])) > timedelta(days=90):
            last = hba1c_labs[0]["date"][:10] if hba1c_labs else "never"
            gaps.append({"label": "HbA1c overdue", "severity": "high", "rationale": f"Diabetic patient — last HbA1c: {last}"})

    # Rule 2: Flu vaccine missing (no immunization this season)
    current_year = today.year
    season_start = date(current_year - 1 if today.month < 9 else current_year, 9, 1)
    flu_vaccines = [
        i for i in aggregate["immunizations"]
        if "influenza" in (i.get("vaccine") or "").lower() or "flu" in (i.get("vaccine") or "").lower()
        and i.get("date") and date.fromisoformat(i["date"][:10]) >= season_start
    ]
    if not flu_vaccines:
        gaps.append({"label": "Annual flu vaccine missing", "severity": "medium", "rationale": f"No influenza immunization recorded since {season_start}"})

    # Rule 3: Elevated BP with no follow-up
    bp_obs = [v for v in aggregate["vitals"] if "systolic" in (v.get("code") or "").lower() or "blood pressure" in (v.get("code") or "").lower()]
    if bp_obs and bp_obs[0].get("value") and float(bp_obs[0]["value"]) > 140:
        last_encounter = aggregate["visit_history"][0]["date"][:10] if aggregate["visit_history"] else None
        if not last_encounter or (today - date.fromisoformat(last_encounter)) > timedelta(days=30):
            gaps.append({"label": "Elevated BP — no recent follow-up", "severity": "high", "rationale": f"Last systolic: {bp_obs[0]['value']} mmHg. No encounter in last 30 days."})

    return gaps


def _get_patient_profile(patient: dict) -> dict:
    """Extract all 15 Synthea-present fields from a FHIR Patient resource."""
    official_name = next(
        (n for n in patient.get("name", []) if n.get("use") == "official"),
        patient.get("name", [{}])[0] if patient.get("name") else {},
    )
    ext_map: dict = {e["url"]: e for e in patient.get("extension", [])}

    def _ext_text(url: str, sub_url: str = "text", value_key: str = "valueString") -> str | None:
        ext = ext_map.get(url)
        if not ext:
            return None
        for sub in ext.get("extension", []):
            if sub.get("url") == sub_url:
                return sub.get(value_key)
        return ext.get(value_key)

    birth_place_ext = ext_map.get("http://hl7.org/fhir/StructureDefinition/patient-birthPlace")
    birth_place = None
    if birth_place_ext:
        addr = birth_place_ext.get("valueAddress", {})
        birth_place = ", ".join(p for p in [addr.get("city"), addr.get("state"), addr.get("country")] if p)

    addr_list = patient.get("address", [])
    address = None
    if addr_list:
        a = addr_list[0]
        address = {
            "line": ", ".join(a.get("line", [])),
            "city": a.get("city"),
            "state": a.get("state"),
            "postal_code": a.get("postalCode"),
            "country": a.get("country"),
        }

    given = official_name.get("given", [])
    prefix_list = official_name.get("prefix", [])
    comms = patient.get("communication", [])

    return {
        "first_name": given[0] if given else None,
        "last_name": official_name.get("family"),
        "prefix": prefix_list[0] if prefix_list else None,
        "gender": patient.get("gender"),
        "birth_date": patient.get("birthDate"),
        "phone": next((t.get("value") for t in patient.get("telecom", []) if t.get("system") == "phone"), None),
        "address": address,
        "marital_status": patient.get("maritalStatus", {}).get("text"),
        "language": comms[0].get("language", {}).get("text") if comms else None,
        "multiple_birth": patient.get("multipleBirthBoolean"),
        "race": _ext_text("http://hl7.org/fhir/us/core/StructureDefinition/us-core-race"),
        "ethnicity": _ext_text("http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity"),
        "birth_sex": ext_map.get("http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex", {}).get("valueCode"),
        "mothers_maiden_name": ext_map.get("http://hl7.org/fhir/StructureDefinition/patient-mothersMaidenName", {}).get("valueString"),
        "birth_place": birth_place,
    }


def get_patient_summary(patient_id: str) -> dict:
    patient_resource = fhir_client.get_resource("Patient", patient_id)

    official_name = next(
        (n for n in patient_resource.get("name", []) if n.get("use") == "official"),
        patient_resource.get("name", [{}])[0] if patient_resource.get("name") else {},
    )
    given = official_name.get("given", [""])
    patient_name = f"{given[0] if given else ''} {official_name.get('family', '')}".strip()

    problems = _get_problems(patient_id)
    medications = _get_medications(patient_id)
    allergies = _get_allergies(patient_id)
    vitals = _get_vitals(patient_id)
    labs = _get_labs(patient_id)
    visit_history = _get_visit_history(patient_id)
    immunizations = _get_immunizations(patient_id)

    aggregate = {
        "patient_id": patient_id,
        "patient_name": patient_name,
        "patient_profile": _get_patient_profile(patient_resource),
        "problems": problems,
        "medications": medications,
        "allergies": allergies,
        "vitals": vitals,
        "labs": labs,
        "visit_history": visit_history,
        "immunizations": immunizations,
    }
    aggregate["care_gaps"] = _run_care_gap_rules(aggregate)
    aggregate["profile_completeness"] = _get_profile_completeness(patient_resource)
    return aggregate
