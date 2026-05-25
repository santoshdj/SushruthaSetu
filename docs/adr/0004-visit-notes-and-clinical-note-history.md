# ADR 0004: Visit Notes & Clinical Note History

**Date:** 2026-05-19
**Updated:** 2026-05-25 — Role values aligned with ADR-0003 update (`clinician_user` / `clinician_admin`)
**Status:** Accepted
**Deciders:** Product owner (via design interview, 2026-05-19)
**Extends:** ADR-0001 (dashboard sections), ADR-0003 (permission matrix)

---

## Context

The Patient Dashboard is currently read-only. Clinicians need two new capabilities:

1. **See notes from previous visits** — both EHR-sourced Clinical Notes and notes written in this app.
2. **Capture a note during the current visit** — with live transcription and explicit save.

All decisions were made during a structured design interview on 2026-05-19.

---

## Decisions

### 1. FHIR Resource Type: `DocumentReference` for both note types

**Decision:** Both Clinical Notes (read from FHIR) and Visit Notes (written by this app) use the `DocumentReference` FHIR resource. Visit Notes are distinguished from Clinical Notes by a meta tag: `meta.tag[0] = { system: "patient-mgmt-app", code: "visit-note" }`.

**Rationale:** `DocumentReference` is the resource Synthea uses for its generated clinical notes, so the fetch and render path is identical for both note types. It supports plain text content encoded as Base64. It is universally supported across FHIR R4 servers. `ClinicalImpression` and `Composition` were rejected as over-engineered for a free-text note box.

**Alternatives rejected:**
- *Local database (SQLite/Postgres)* — adds infrastructure not needed if the FHIR sandbox accepts writes. Deferred to a future phase if FHIR write proves unreliable.
- *`ClinicalImpression`* — poorly supported in sandbox servers; structured fields are unnecessary for MVP.
- *`Composition`* — full SOAP-section documents; too complex for MVP.

---

### 2. Storage: FHIR sandbox via `create_resource`

**Decision:** Visit Notes are POSTed to the FHIR sandbox using the existing `fhir_client.create_resource("DocumentReference", body)` function. The backend exposes `POST /patients/{patient_id}/notes`. No local database is added for MVP.

**Rationale:** `create_resource` already exists and is tested. The Medblocks sandbox accepts writes. Using FHIR as the store means Visit Notes are immediately queryable alongside Clinical Notes via the same `DocumentReference` search, with no synchronisation problem.

**Risk acknowledged:** The Medblocks sandbox is shared and public. All POSTed content will be visible to other sandbox users. Acceptable for synthetic/demo data; not acceptable for real PHI. A private FHIR server or local database must be used before handling real patient data.

---

### 3. Previous Visit Notes: inline expand on the Patient Dashboard

**Decision:** A "Previous Visit Notes" card is added to the Patient Dashboard. It shows the most recent note (Clinical Note or Visit Note) by default. A "Show all N notes" toggle expands the full list inline, sorted newest-first, each note showing date, source label (EHR / This App), and full text.

**Rationale:** Keeping the clinician on the Patient Dashboard avoids a context switch. A separate notes history route (`/patients/{id}/notes`) is deferred to a future phase.

---

### 4. Current Visit Note: sticky bottom panel

**Decision:** A sticky panel is fixed to the bottom of the viewport on the Patient Dashboard. It is collapsed to a thin bar by default ("📝 Current Visit Note") and expands to a full textarea + controls on click. The clinician can scroll the dashboard freely while the note panel remains accessible.

**Rationale:** The note box must be reachable at any point during the visit — whether the clinician is looking at labs, vitals, or problems. A card in the grid would require scrolling. A sticky panel matches the pattern used by Epic and other clinical documentation tools.

---

### 5. Transcription: Web Speech API, live, edit-before-save

**Decision:** The note panel includes a microphone toggle button. When active, the browser's `SpeechRecognition` API streams interim and final results into the textarea in real time. The clinician edits the transcribed text freely. The note is only written to FHIR when the clinician clicks "Save Note" — transcription alone does not trigger a save.

**Rationale:** Web Speech API is zero-cost, zero-latency, and requires no backend involvement. It works in Chrome and Edge, which are the browsers used on clinical workstations. Server-side transcription (Whisper, AssemblyAI) was rejected for MVP due to latency, cost, and API key management overhead.

**Limitation:** Web Speech API is not supported in Firefox or Safari. Acceptable for MVP; server-side fallback deferred.

---

### 6. Draft persistence: localStorage keyed by `patient_id`

**Decision:** As the clinician types, the note text is debounce-saved to `localStorage` under the key `visit-note-draft-{patient_id}`. On returning to the same Patient Dashboard, the draft is restored into the note box with an "Unsaved draft from HH:MM" banner. Saving or explicitly discarding the note clears the draft.

**Rationale:** Clinicians must not lose work due to accidental navigation. A silent localStorage draft is non-intrusive and reliable. `beforeunload` browser dialogs (Option A) were rejected as they cause dialog blindness. A custom navigation-blocking modal (Option C) was rejected as non-trivial to wire correctly with React Router v6.

---

### 7. Permission update (extends ADR-0003)

**Decision:** The permission matrix from ADR-0003 is extended:

| Feature | `clinician_user` | `clinician_admin` |
|---|---|---|
| View Previous Visit Notes | ✅ | ✅ |
| Save Visit Note | ✅ | ✅ |

**Rationale:** Saving a Visit Note is a clinical action, not a registration action. Both `clinician_user` and `clinician_admin` must be able to save notes. The backend enforces this: `POST /patients/{patient_id}/notes` accepts tokens with either `clinician_user` or `clinician_admin` role.

---

## Consequences

- `GET /patients/{patient_id}/notes` added — fetches `DocumentReference` resources, returns array of `{id, date, source, text}`.
- `POST /patients/{patient_id}/notes` added — accepts `{text, encounter_date}`, POSTs a `DocumentReference` to FHIR.
- Frontend: "Previous Visit Notes" card added to Patient Dashboard.
- Frontend: `VisitNotePanel` sticky component added to Patient Dashboard.
- Frontend: `useSpeechRecognition` hook encapsulates Web Speech API.
- Frontend: draft auto-save to localStorage on every keystroke (debounced 500ms).
