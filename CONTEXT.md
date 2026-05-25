# Patient Management App — Domain Glossary

This file defines the canonical terms used across the codebase and documentation.
Update here first; code naming follows this glossary.

---

## Clinical Note

A note that **originated in the EHR / FHIR system**. Fetched as a `DocumentReference` resource from the FHIR server (e.g. Synthea-generated notes). Read-only — this app never modifies Clinical Notes.

## Visit Note

A note **authored by a clinician using this app** during or after a patient encounter. Stored as a `DocumentReference` resource POSTed to the FHIR server by this app. The `meta.tag` field carries `system: "patient-mgmt-app", code: "visit-note"` to distinguish Visit Notes from Clinical Notes on read-back.

## Patient Hub

The per-patient view reached by clicking a patient on the Schedule or Patients page. Displays a **Patient Identity Strip** at the top (name, age, sex, ethnicity, DOB), followed by three visit-critical items: the AI Pre-Visit Summary, Care Gaps, and the Current Visit Note panel. An icon strip provides one-tap navigation to dedicated **Clinical Detail Pages** for each clinical data section. Previously called "Patient Dashboard."

## Patient Identity Strip

A compact header on the Patient Hub showing the minimum demographic context a clinician needs during an encounter: Given Name, Family Name, Age (calculated), Sex, Ethnicity, and Date of Birth. Read-only. Full demographics and profile completeness are on the Profile Clinical Detail Page.

## Clinical Detail Page

A dedicated page for a single clinical data section (e.g. Medications, Labs, Vitals), reached by tapping its icon on the Patient Hub. Each page can have its own layout, sorting, and filtering suited to that data type. URL pattern: `/patients/:patientId/:section`.

## Previous Visit Notes

The section of the Patient Dashboard that displays Clinical Notes and Visit Notes from prior encounters, sorted newest-first. Shows the most recent note by default; a "Show all N notes" toggle expands the full list inline.

## Current Visit Note

The sticky bottom panel on the Patient Dashboard where a clinician types or dictates a note for the ongoing encounter. Supports live transcription via the Web Speech API. Text flows into an editable textarea. The note is only saved to FHIR when the clinician explicitly clicks "Save Note". Unsaved text is persisted as a localStorage draft keyed by `patient_id`.

## Draft Note

An unsaved Current Visit Note that has been persisted to `localStorage` keyed by `patient_id`. Restored into the note box on return to the same Patient Dashboard, with an "Unsaved draft from HH:MM" banner.

## Transcription

Real-time speech-to-text powered by the browser's Web Speech API (`SpeechRecognition`). Produces live interim and final results streamed into the Current Visit Note textarea. The clinician edits the transcribed text before saving.

## Audit Event

A record of a clinician-initiated or system-detected activity stored as a FHIR R4 `AuditEvent` resource on the Medblocks FHIR server. Covers five activity types: Login, Patient Viewed, Patient Created, Patient Updated, and Unauthorized Access Attempt. Displayed in aggregate on the **Events Page**. Never modified after creation — append-only. Always created by the **backend**; the frontend notifies the backend via `POST /api/audit` for Login events only — all other events are captured at the backend API call boundary. AuditEvent writes are **fire-and-forget** — a write failure is logged server-side but never surfaced to the clinician and never blocks the main operation.

## Unauthorized Access Attempt

An **Unauthorized Access Attempt** Audit Event is created whenever the backend returns HTTP 401 (missing, expired, or invalid token) or HTTP 403 (valid token but insufficient role). Captured by a single FastAPI `HTTPException` handler that checks `status_code in (401, 403)`. Agent identity is the Clerk user ID (`sub` claim) when available; `"unknown"` when no valid token was present.

## Events Page

A global read-only page at `/events` showing all Audit Events across all patients in reverse-chronological order. Filterable by event type and date range. Serves as both an activity log and a security dashboard.

Table columns: **Timestamp** (`AuditEvent.recorded`), **Event Type** (`AuditEvent.subtype[0].display`), **User** (`AuditEvent.agent[0].who.display`, Clerk user ID or "unknown"), **Patient** (`AuditEvent.entity[0].what.display`, blank for Login / Unauthorized events), **Outcome** (`AuditEvent.outcome`, "Success" or "Failure").

## AI Pre-Visit Summary

A clinician-facing snapshot generated on demand by Claude from the patient aggregate (problems, medications, allergies, vitals, labs, care gaps, last visit). Returns exactly **4–5 bullet points** — never more — ordered by clinical priority: active concerns requiring action first, then recent significant changes, overdue care items, and high-severity care gaps. Lower-priority background items are dropped to stay within the limit. Never saved or persisted.

## Vitals Trend Table

The default view on the Vitals Clinical Detail Page. Displays readings for the selected vital type in **reverse-chronological order** (newest first) with columns: Date, Value, Unit, Reference Range (`low – high`), **Δ Change** (arrow + signed numeric delta vs. the prior reading), and Status badge. Abnormal values (outside reference range) are shown in red. The chart view is available via "View as chart" toggle. Previously the chart was the default.

## Lab Results Page

The Labs Clinical Detail Page. Labs are **grouped by test name** and sorted by most recent date (most recently updated test group first). Within each group, only the **2 most recent results** are shown by default. A "Show N older results" link per group expands the full history inline. Abnormal values are shown in red with the reference range in an adjacent column.

## Action Recommendation

A clinician-facing suggestion generated by AI from the Current Visit Note text, the patient aggregate, and up to 5 Previous Visit Notes. Each Action Recommendation has a category (Medications / Lab Tests / Referrals / Follow-up / Patient Education), a specific action text, an urgency level (routine / urgent / critical), and a rationale. Action Recommendations are generated on demand — the clinician explicitly requests them by clicking "Suggest next steps" in the Visit Note panel. They are never saved or persisted; they exist only for the duration of the current dashboard session.
