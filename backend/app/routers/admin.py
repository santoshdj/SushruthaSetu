"""
Admin-only endpoints.

POST /admin/seed-clinician-patients — one-time distribution of untagged FHIR
Patient resources between two demo Clinician User accounts.
"""

import logging
import random
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth import require_admin
from app import fhir_client
from app.services.patient_service import CLINICIAN_TAG_SYSTEM

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])


class SeedRequest(BaseModel):
    clinician_1_id: str
    clinician_2_id: str


@router.post("/seed-clinician-patients")
def seed_clinician_patients(
    body: SeedRequest,
    _: Annotated[dict, Depends(require_admin)],
) -> dict:
    """Randomly distribute all untagged Patient resources 50/50 between two clinicians."""
    bundle = fhir_client.search_resource("Patient", {"_count": 1000})
    all_entries = bundle.get("entry", [])

    untagged: list[dict] = []
    for entry in all_entries:
        resource = entry.get("resource", {})
        tags = resource.get("meta", {}).get("tag", [])
        has_clinician_tag = any(t.get("system") == CLINICIAN_TAG_SYSTEM for t in tags)
        if not has_clinician_tag:
            untagged.append(resource)

    if not untagged:
        return {"message": "No untagged patients found — nothing to seed.", "tagged": 0}

    random.shuffle(untagged)
    mid = len(untagged) // 2
    assignments = [
        (body.clinician_1_id, untagged[:mid]),
        (body.clinician_2_id, untagged[mid:]),
    ]

    tagged_count = 0
    errors = 0
    for clinician_id, patients in assignments:
        for resource in patients:
            meta = resource.setdefault("meta", {})
            existing_tags = [t for t in meta.get("tag", []) if t.get("system") != CLINICIAN_TAG_SYSTEM]
            meta["tag"] = existing_tags + [{"system": CLINICIAN_TAG_SYSTEM, "code": clinician_id}]
            try:
                fhir_client.update_resource("Patient", resource["id"], resource)
                tagged_count += 1
            except Exception as exc:
                logger.error("Failed to tag patient %s: %s", resource.get("id"), exc)
                errors += 1

    return {
        "message": f"Tagged {tagged_count} patients ({errors} errors).",
        "clinician_1_count": len(assignments[0][1]),
        "clinician_2_count": len(assignments[1][1]),
        "errors": errors,
    }
