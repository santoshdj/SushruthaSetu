"""
Patient list and registration service.
Handles FHIR Patient search, create (POST), and update (PUT).
"""

import logging
from typing import Any

from app import fhir_client
from app.models.patient import (
    PatientCreate,
    PatientUpdate,
    PatientResponse,
    PatientListResponse,
)

logger = logging.getLogger(__name__)

_PAGE_SIZE = 20


def _parse_patient(resource: dict) -> PatientResponse:
    name = resource.get("name", [{}])[0]
    given = name.get("given", [""])
    return PatientResponse(
        id=resource["id"],
        first_name=given[0] if given else "",
        last_name=name.get("family", ""),
        prefix=name.get("prefix", [None])[0],
        gender=resource.get("gender", "unknown"),
        birth_date=resource.get("birthDate", ""),
    )


def _build_fhir_patient(data: PatientCreate | PatientUpdate, patient_id: str | None = None) -> dict:
    name: dict[str, Any] = {
        "use": "official",
        "family": data.last_name,
        "given": [data.first_name],
    }
    if data.prefix:
        name["prefix"] = [data.prefix]

    resource: dict[str, Any] = {
        "resourceType": "Patient",
        "name": [name],
        "gender": data.gender,
        "birthDate": data.birth_date.isoformat(),
    }
    if patient_id:
        resource["id"] = patient_id
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


def create_patient(data: PatientCreate) -> PatientResponse:
    body = _build_fhir_patient(data)
    resource = fhir_client.create_resource("Patient", body)
    return _parse_patient(resource)


def update_patient(patient_id: str, data: PatientUpdate) -> PatientResponse:
    body = _build_fhir_patient(data, patient_id=patient_id)
    resource = fhir_client.update_resource("Patient", patient_id, body)
    return _parse_patient(resource)
