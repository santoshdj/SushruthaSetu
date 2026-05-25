"""
Patient list and registration service.
Handles FHIR Patient search, create (POST), and update (PUT).
"""

import logging
from typing import Any

from app import fhir_client
from app.models.patient import (
    PatientAddress,
    PatientCreate,
    PatientUpdate,
    PatientResponse,
    PatientListResponse,
)

logger = logging.getLogger(__name__)

_PAGE_SIZE = 20

_RACE_CODES: dict[str, str] = {
    "White": "2106-3",
    "Black or African American": "2054-5",
    "Asian": "2028-9",
    "American Indian or Alaska Native": "1002-5",
    "Native Hawaiian or Other Pacific Islander": "2076-8",
    "Other Race": "2131-1",
}
_ETHNICITY_CODES: dict[str, str] = {
    "Hispanic or Latino": "2135-2",
    "Not Hispanic or Latino": "2186-5",
}
_BIRTHSEX_CODES: dict[str, str] = {"Male": "M", "Female": "F", "Unknown": "UNK"}
_BIRTHSEX_DECODE: dict[str, str] = {"M": "Male", "F": "Female", "F": "Female"}
_MARITAL_CODES: dict[str, str] = {
    "Married": "M", "Single": "S", "Divorced": "D", "Widowed": "W",
    "Separated": "L", "Domestic Partner": "T", "Unknown": "U",
}

_MANAGED_EXT_URLS = {
    "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race",
    "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity",
    "http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex",
    "http://hl7.org/fhir/StructureDefinition/patient-mothersMaidenName",
    "http://hl7.org/fhir/StructureDefinition/patient-birthPlace",
}


def _parse_patient(resource: dict) -> PatientResponse:
    name = resource.get("name", [{}])[0]
    given = name.get("given", [""])

    # Address
    addr_list = resource.get("address", [])
    addr = addr_list[0] if addr_list else None
    address = PatientAddress(
        line=addr["line"][0] if addr and addr.get("line") else None,
        city=addr.get("city") if addr else None,
        state=addr.get("state") if addr else None,
        postal_code=addr.get("postalCode") if addr else None,
        country=addr.get("country") if addr else None,
    ) if addr else None

    # Phone
    phone: str | None = None
    for tc in resource.get("telecom", []):
        if tc.get("system") == "phone":
            phone = tc.get("value")
            break
    if phone is None and resource.get("telecom"):
        phone = resource["telecom"][0].get("value")

    # Marital status
    marital_status: str | None = None
    ms = resource.get("maritalStatus", {})
    if ms:
        marital_status = ms.get("text") or (
            ms["coding"][0].get("display") if ms.get("coding") else None
        )

    # Language
    language: str | None = None
    comm = resource.get("communication", [])
    if comm:
        lang = comm[0].get("language", {})
        language = lang.get("text") or (
            lang["coding"][0].get("display") if lang.get("coding") else None
        )

    # Multiple birth
    multiple_birth: bool | None = resource.get("multipleBirthBoolean")

    # Extensions
    race: str | None = None
    ethnicity: str | None = None
    birth_sex: str | None = None
    mothers_maiden_name: str | None = None
    birth_place: str | None = None

    for ext in resource.get("extension", []):
        url = ext.get("url", "")
        if url == "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race":
            for sub in ext.get("extension", []):
                if sub.get("url") == "text":
                    race = sub.get("valueString")
                    break
        elif url == "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity":
            for sub in ext.get("extension", []):
                if sub.get("url") == "text":
                    ethnicity = sub.get("valueString")
                    break
        elif url == "http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex":
            code = ext.get("valueCode", "")
            birth_sex = {"M": "Male", "F": "Female"}.get(code, "Unknown") if code else None
        elif url == "http://hl7.org/fhir/StructureDefinition/patient-mothersMaidenName":
            mothers_maiden_name = ext.get("valueString")
        elif url == "http://hl7.org/fhir/StructureDefinition/patient-birthPlace":
            va = ext.get("valueAddress", {})
            birth_place = va.get("text") or va.get("city") or va.get("state")

    return PatientResponse(
        id=resource["id"],
        first_name=given[0] if given else "",
        last_name=name.get("family", ""),
        prefix=name.get("prefix", [None])[0],
        gender=resource.get("gender", "unknown"),
        birth_date=resource.get("birthDate", ""),
        phone=phone,
        address=address,
        marital_status=marital_status,
        multiple_birth=multiple_birth,
        language=language,
        mothers_maiden_name=mothers_maiden_name,
        birth_place=birth_place,
        race=race,
        ethnicity=ethnicity,
        birth_sex=birth_sex,
    )


def _apply_form_to_fhir(
    data: PatientCreate | PatientUpdate,
    existing: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build a FHIR Patient resource from form data.
    If existing is provided, starts from it and overlays only managed fields,
    preserving all other FHIR data (e.g. Synthea clinical extensions).
    """
    resource: dict[str, Any] = dict(existing) if existing else {"resourceType": "Patient"}

    # Name
    name_entry: dict[str, Any] = {
        "use": "official",
        "family": data.last_name,
        "given": [data.first_name],
    }
    if data.prefix:
        name_entry["prefix"] = [data.prefix]
    resource["name"] = [name_entry]

    resource["gender"] = data.gender
    resource["birthDate"] = data.birth_date.isoformat()

    # Phone
    if data.phone:
        resource["telecom"] = [{"system": "phone", "value": data.phone, "use": "home"}]
    else:
        resource.pop("telecom", None)

    # Address
    if data.address and any(
        v for v in (data.address.line, data.address.city, data.address.state,
                    data.address.postal_code, data.address.country) if v
    ):
        addr: dict[str, Any] = {"use": "home"}
        if data.address.line:
            addr["line"] = [data.address.line]
        if data.address.city:
            addr["city"] = data.address.city
        if data.address.state:
            addr["state"] = data.address.state
        if data.address.postal_code:
            addr["postalCode"] = data.address.postal_code
        if data.address.country:
            addr["country"] = data.address.country
        resource["address"] = [addr]
    else:
        resource.pop("address", None)

    # Marital status
    if data.marital_status:
        code = _MARITAL_CODES.get(data.marital_status, "U")
        resource["maritalStatus"] = {
            "coding": [{"system": "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus", "code": code}],
            "text": data.marital_status,
        }
    else:
        resource.pop("maritalStatus", None)

    # Multiple birth
    if data.multiple_birth is not None:
        resource["multipleBirthBoolean"] = data.multiple_birth
    else:
        resource.pop("multipleBirthBoolean", None)

    # Language
    if data.language:
        resource["communication"] = [{"language": {"text": data.language}}]
    else:
        resource.pop("communication", None)

    # Extensions — preserve non-managed, replace managed
    preserved = [e for e in resource.get("extension", []) if e.get("url") not in _MANAGED_EXT_URLS]
    new_exts: list[dict[str, Any]] = []

    if data.race:
        code = _RACE_CODES.get(data.race, "2131-1")
        new_exts.append({
            "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race",
            "extension": [
                {"url": "ombCategory", "valueCoding": {
                    "system": "urn:oid:2.16.840.1.113883.6.238",
                    "code": code, "display": data.race,
                }},
                {"url": "text", "valueString": data.race},
            ],
        })
    if data.ethnicity:
        code = _ETHNICITY_CODES.get(data.ethnicity, "2186-5")
        new_exts.append({
            "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity",
            "extension": [
                {"url": "ombCategory", "valueCoding": {
                    "system": "urn:oid:2.16.840.1.113883.6.238",
                    "code": code, "display": data.ethnicity,
                }},
                {"url": "text", "valueString": data.ethnicity},
            ],
        })
    if data.birth_sex:
        new_exts.append({
            "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex",
            "valueCode": _BIRTHSEX_CODES.get(data.birth_sex, "UNK"),
        })
    if data.mothers_maiden_name:
        new_exts.append({
            "url": "http://hl7.org/fhir/StructureDefinition/patient-mothersMaidenName",
            "valueString": data.mothers_maiden_name,
        })
    if data.birth_place:
        new_exts.append({
            "url": "http://hl7.org/fhir/StructureDefinition/patient-birthPlace",
            "valueAddress": {"text": data.birth_place},
        })

    all_exts = preserved + new_exts
    if all_exts:
        resource["extension"] = all_exts
    else:
        resource.pop("extension", None)

    return resource


def list_patients(name: str | None = None, page_token: str | None = None) -> PatientListResponse:
    if page_token:
        bundle = fhir_client.fetch_bundle_page(page_token)
    else:
        params: dict[str, Any] = {"_count": _PAGE_SIZE}
        if name:
            params["name"] = name
        bundle = fhir_client.search_resource("Patient", params)

    entries = bundle.get("entry", [])
    patients = [_parse_patient(e["resource"]) for e in entries if "resource" in e]

    next_token = None
    prev_token = None
    for link in bundle.get("link", []):
        if link.get("relation") == "next":
            next_token = link["url"]
        if link.get("relation") == "previous":
            prev_token = link["url"]

    return PatientListResponse(
        patients=patients,
        next_page_token=next_token,
        previous_page_token=prev_token,
    )


def get_patient(patient_id: str) -> PatientResponse:
    resource = fhir_client.get_resource("Patient", patient_id)
    return _parse_patient(resource)


def create_patient(data: PatientCreate) -> PatientResponse:
    body = _apply_form_to_fhir(data)
    resource = fhir_client.create_resource("Patient", body)
    return _parse_patient(resource)


def update_patient(patient_id: str, data: PatientUpdate) -> PatientResponse:
    existing = fhir_client.get_resource("Patient", patient_id)
    body = _apply_form_to_fhir(data, existing=existing)
    resource = fhir_client.update_resource("Patient", patient_id, body)
    return _parse_patient(resource)
