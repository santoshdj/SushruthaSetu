# ADR 0007 — Clinician-Scoped Patient and Schedule Visibility via FHIR `meta.tag`

**Date:** 2025-07-21
**Status:** Accepted

---

## Context

SushruthaSetu must support multiple Clinician Users where each user sees only their own patients in the Patients page and Schedule page, while a Clinician Admin sees all patients. The FHIR server (Medblocks) is the single system of record for Patient resources; there is no separate relational database in the current architecture.

Three options were considered for tracking which patients belong to which clinician:

| Option | Mechanism | Pros | Cons |
|---|---|---|---|
| **A — FHIR `meta.tag`** | Stamp each Patient resource with `{ system: "patient-mgmt-app/clinician", code: <clerk_user_id> }` at creation | No extra storage; FHIR `_tag` search filters server-side; portable with the resource | Couples app metadata to FHIR resource; requires data migration for pre-existing patients; some FHIR servers may not index custom tags |
| **B — FHIR extension** | Add a custom extension element to each Patient | Semantically richer than a tag | More verbose; harder to search; not well-supported for filtering on all FHIR R4 servers |
| **C — App-level lookup table** | Maintain a separate store (DynamoDB / Postgres) mapping `patient_id → clinician_id` | Fully decoupled from FHIR; easy to change ownership | Adds a second data store; ownership can drift out of sync with FHIR; more infrastructure |

## Decision

**Option A — FHIR `meta.tag`** was chosen.

- The FHIR R4 `meta.tag` field is specifically designed for system-specific labels and supports the standard `_tag` search parameter for server-side filtering, avoiding a full-patient-scan on every list request.
- Medblocks FHIR supports `_tag` search.
- Keeps the architecture simple: one data store (FHIR), no synchronisation risk.

## Implementation

- **Constant:** `CLINICIAN_TAG_SYSTEM = "patient-mgmt-app/clinician"` in `patient_service.py`.
- **Creation:** `create_patient(data, clinician_id)` stamps `meta.tag` on the FHIR `Patient` body before `POST`.
- **Listing:** `list_patients(..., clinician_id)` appends `_tag=<system>|<clinician_id>` to the FHIR search when the caller is not an admin.
- **Schedule:** `get_today_schedule(clinician_id)` fetches the set of patient IDs tagged with that clinician via `_tag` search, then filters the appointment list client-side.
- **Role check:** Routers read `publicMetadata.role` from the verified Clerk JWT. `"clinician_admin"` bypasses the tag filter; any other role applies it.
- **Seeding:** `POST /admin/seed-clinician-patients` (admin-only) distributes existing untagged patients randomly 50/50 between two Clerk user IDs for demo environments.

## Consequences

- **Positive:** Server-side filtering keeps response payloads small; no extra infrastructure; Patient resources are self-describing regarding ownership.
- **Negative:** Ownership is baked into FHIR resources and requires a FHIR `PUT` to change (re-assigning patients between clinicians is possible but not trivially reversible in bulk). Pre-existing (Synthea-seeded) patients need a one-time seeding operation.
- **Neutral:** Patients created before this feature was deployed appear to no-one except admins until seeded. The seed endpoint handles this explicitly.
