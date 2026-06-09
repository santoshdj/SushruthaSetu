# Patient Management App — Domain Glossary

**Product focus:** Chronic disease management for Primary Care / Family Medicine clinicians, with an initial scope of **Diabetes and Hypertension**. The app is optimised for the recurring encounter journey of patients living with these conditions — before, during, and after each visit.

This file defines the canonical terms used across the codebase and documentation.
Update here first; code naming follows this glossary.

---

## Clinical Note

A note that **originated in the EHR / FHIR system**. Fetched as a `DocumentReference` resource from the FHIR server (e.g. Synthea-generated notes). Read-only — this app never modifies Clinical Notes.

## Visit Note

A note **authored by a clinician using this app** during or after a patient encounter. Stored as a `DocumentReference` resource POSTed to the FHIR server by this app. The `meta.tag` field carries `system: "patient-mgmt-app", code: "visit-note"` to distinguish Visit Notes from Clinical Notes on read-back.

## Patient Hub

The per-patient view reached by clicking a patient on the Schedule or Patients page. Displays a **Patient Identity Strip** at the top (name, age, sex, ethnicity, DOB), immediately followed by a **Disease Control Status Strip**, then three visit-critical items: the AI Pre-Visit Summary, Care Gaps, and the Current Visit Note panel. An icon strip provides one-tap navigation to dedicated **Clinical Detail Pages** for each clinical data section. Previously called "Patient Dashboard."

## Disease Control Status Strip

A compact bar directly below the Patient Identity Strip on the Patient Hub. Surfaces the two most critical chronic disease markers — HbA1c (diabetes) and most recent Blood Pressure reading (hypertension) — at a glance, before the clinician reads any narrative content.

Each marker shows: current value, age of the reading, and a colour-coded control status badge:
- **Green** — controlled (HbA1c < 7%, BP < 130/80)
- **Amber** — borderline (HbA1c 7–8%, BP 130–140 / 80–90)
- **Red** — uncontrolled or overdue reading (HbA1c > 8%, BP > 140/90, or last reading > 3 months ago)
- **Grey / "No data"** — no reading on record; displayed rather than hidden to make the gap visible

Clicking a status badge deep-links directly to the relevant Clinical Detail Page (Labs for HbA1c, Vitals for BP). Values are derived from the Labs and Vitals data already fetched for the Patient Hub — no additional API calls are required.

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

Table columns: **Timestamp** (`AuditEvent.recorded`), **Event Type** (`AuditEvent.subtype[0].display`), **User** (`AuditEvent.agent[0].who.display`, Clerk user ID or "unknown"), **Name** (`AuditEvent.agent[0].name`, human-readable full name captured at write time from the Clerk JWT `first_name`/`last_name` claims; "—" for events written before this feature was added), **Patient** (`AuditEvent.entity[0].what.display`, blank for Login / Unauthorized events), **Outcome** (`AuditEvent.outcome`, "Success" or "Failure"). An **Export CSV** button downloads the currently filtered view as a CSV file (client-side, filename `audit-events-YYYY-MM-DD.csv`).

Access is restricted to **Clinician Admin** users. Clinician User accounts that navigate directly to `/events` are silently redirected to `/` by the `AdminRoute` layout route. The **Events** navigation link is hidden from the nav bar for all Clinician User accounts.

## AI Pre-Visit Summary

A clinician-facing snapshot generated on demand by Claude from the patient aggregate (problems, medications, allergies, vitals, labs, care gaps, last visit). Returns exactly **4–5 bullet points** — never more — ordered by clinical priority: active concerns requiring action first, then recent significant changes, overdue care items, and high-severity care gaps. Lower-priority background items are dropped to stay within the limit. Never saved or persisted.

## Care Gap

A proactive care opportunity identified by the app for a patient — e.g. overdue HbA1c, elevated blood pressure with no recent med change, missed annual eye exam. Each Care Gap has a title, a severity (low / medium / high), a rationale, and a **Guideline Citation**.

## Guideline Citation

A structured reference to the clinical guideline that justifies a Care Gap flag or Action Recommendation rationale. Displayed as both an inline sentence in the card body and a short badge label on the card. Two guideline bodies are used:

- **ADA 2024** — American Diabetes Association Standards of Medical Care in Diabetes 2024. Used for diabetes-specific items: HbA1c frequency and targets, foot exam, eye exam, microalbumin screening.
- **AHA/ACC 2017** — American Heart Association / American College of Cardiology Hypertension Guidelines. Used for blood pressure targets and treatment thresholds.

Format: *"Per ADA 2024: HbA1c should be measured every 3 months when uncontrolled (>8%)."* Badge label: `ADA 2024` or `AHA/ACC 2017`. Badge text is static (not a hyperlink) in the current implementation.

## Vitals Trend Table

The default view on the Vitals Clinical Detail Page. Displays readings for the selected vital type in **reverse-chronological order** (newest first) with columns: Date, Value, Unit, Reference Range (`low – high`), **Δ Change** (arrow + signed numeric delta vs. the prior reading), and Status badge. Abnormal values (outside reference range) are shown in red. The chart view is available via "View as chart" toggle — including for a single data point, where the reading renders as a lone dot against the reference range band. Previously the chart was the default.

## Lab Results Page

The Labs Clinical Detail Page. Labs are **grouped by test name** and sorted by most recent date (most recently updated test group first). Within each group, only the **2 most recent results** are shown by default. A "Show N older results" link per group expands the full history inline. Abnormal values are shown in red with the reference range in an adjacent column. Each group has a **"View as chart"** toggle that plots the test's values over time as a line chart with a reference range band — including for a single data point.

## Patient Registration Form

The modal used to **create or edit** a Patient. Wider than the legacy form (`max-w-2xl`), with four collapsible field sections. Mandatory fields are marked with `*`; all optional fields are clearly labelled as such.

**Sections:**
- **Identity** *(always open)*: First Name\*, Last Name\*, Prefix, Gender\*, Date of Birth\*
- **Contact** *(collapsible)*: Phone, Street, City, State, Postal Code, Country
- **Demographics** *(collapsible)*: Marital Status, Multiple Birth, Language, Mother's Maiden Name, Birth Place
- **US Core Clinical** *(collapsible)*: Race, Ethnicity, Birth Sex

On **Create**, Contact / Demographics / US Core Clinical sections are collapsed by default to keep quick registration fast. On **Edit**, all sections are expanded to make incomplete fields visible.

Race, Ethnicity, and Birth Sex use **coded dropdowns** (US Core value sets). Address is collected as **structured sub-fields** (line, city, state, postal code, country). Language is free text (e.g. "English"). Multiple Birth is a Yes / No select.

The Edit flow fetches the full patient via `GET /patients/:id` to pre-populate all 15 fields. The backend `PUT /patients/:id` first fetches the existing FHIR resource, overlays only the form-managed fields, then writes the merged resource — preserving any FHIR data outside the form's scope (e.g. Synthea-generated extensions).

## Action Recommendation

A clinician-facing suggestion generated by AI from the Current Visit Note text, the patient aggregate, and up to 5 Previous Visit Notes. Each Action Recommendation has a category (Medications / Lab Tests / Referrals / Follow-up / Patient Education), a specific action text, an urgency level (routine / urgent / critical), and a rationale. Action Recommendations are generated on demand — the clinician explicitly requests them by clicking "Suggest next steps" in the Visit Note panel. They are never saved or persisted; they exist only for the duration of the current dashboard session.

**Lab Test and Follow-up recommendations are actionable:** each card has an **"+ Add to note"** button that appends a pre-filled **Order Block** to the Current Visit Note.

## Order Block

A structured text fragment appended to the Current Visit Note when the clinician clicks "Add to note" on a Lab Test or Follow-up Action Recommendation. Format:

```
→ Order: <action text>
   Reason: <rationale>
   Date: <today's date>
```

The clinician may edit the inserted text before saving the note. The Order Block becomes part of the persisted Visit Note — it has no independent existence outside the note.

## Patient Ownership

Every Patient FHIR resource is stamped at creation time with a `meta.tag` entry `{ system: "patient-mgmt-app/clinician", code: <clerk_user_id> }` identifying the Clinician User who registered the patient. This tag is the sole authority for determining which patients a Clinician User can see. A **Clinician Admin** is exempt and always sees all patients regardless of ownership. The FHIR `_tag` search parameter is used to filter `GET Patient` results by the authenticated clinician's user ID.

## Clinician User

A user with `publicMetadata.role = "clinician_user"` in Clerk. Can view, create, and edit only the patients they own (see **Patient Ownership**). Can save Visit Notes and request AI Action Recommendations. Cannot access the Events Page.

## Clinician Admin

A user with `publicMetadata.role = "clinician_admin"` in Clerk. Has all Clinician User permissions plus exclusive access to the Events Page. Sees **all patients** across all clinicians — Patient Ownership filtering is bypassed for admin tokens. The `require_admin` FastAPI dependency enforces backend protection of admin-only endpoints, returning HTTP 403 for any Clinician User token.

## Clinician Patient Seeding

A one-time admin operation (`POST /admin/seed-clinician-patients`) that distributes existing untagged FHIR Patient resources randomly between two Clinician Users. Accepts the two Clerk user IDs in the request body. Each untagged patient is assigned to one clinician by adding a **Patient Ownership** `meta.tag`. Already-tagged patients are skipped. Used to initialise demo environments where Synthea-generated patients pre-exist without an owner.

## NoteBody

The component that renders clinical note text with structured visual formatting in the Previous Visit Notes card. Parses each line of the note text:

- Lines starting with `#`, `##`, or `###` → bold, progressively smaller section heading (Markdown-style)
- Lines ending with `:` → bold inline section label
- Lines starting with `- `, `• `, or `* ` → bulleted list item (buffered and flushed as a `<ul>` block)
- All other non-empty lines → plain paragraph text

`NoteBody` is read-only and display-only — it is never used for editing.

## Phone Search

A search mode on the Patients Page that queries the FHIR server using `Patient?telecom=<digits>` (HAPI prefix/partial match on telecom values). The phone value is normalised before querying — all non-digit characters (`+`, spaces, dashes, parens) are stripped. Mutually exclusive with **Name Search**: toggling between modes clears the other input. Degrades gracefully to `Patient?phone=<digits>` (exact token match) if the FHIR server does not support `telecom` string prefix search.

## Name Search

The default search mode on the Patients Page. Queries the FHIR server using `Patient?name=<value>`. Mutually exclusive with **Phone Search**.

## Patient Address Dropdowns

Country, State, and City fields in the **Patient Registration Form** Contact section are rendered as cascaded dropdowns backed by the `country-state-city` static dataset. Selecting a country resets State and City; selecting a state resets City. Country is stored in FHIR `address.country` as an **ISO 3166-1 alpha-2 code** (e.g. `"US"`, `"IN"`) per FHIR R4 recommendations. State is stored as the full state name (e.g. `"California"`). City is stored as the full city name. On edit read-back, free-text country names from pre-dropdown records are resolved to ISO codes via a name-to-code lookup so the dropdown pre-fills correctly.

## Follow-up Due Date

A date stored as a FHIR extension on the Patient resource (`url: "patient-mgmt-app/followup-due"`) that records when the patient's next visit is expected. Set by the clinician at the end of an encounter via a date picker in the Visit Note panel; pre-filled based on Disease Control Status (uncontrolled → +3 months, controlled → +6 months) but always editable. Displayed in the Disease Control Status Strip on the Patient Hub and as an "Overdue" badge on the Patients list when the date has passed and no newer Visit Note exists.

## Panel Risk Score

A computed urgency tier assigned to each patient at panel-load time, derived from existing Disease Control Status and Care Gap signals. Three tiers:

- **High** — any Disease Control Status marker is red (HbA1c > 8% or systolic BP > 140 mmHg or reading > 90 days old) **OR** any open Care Gap has severity `high`
- **Medium** — any marker is amber (HbA1c 7–8%, BP 130–140/80–90) **OR** any open Care Gap has severity `medium`, and no red condition is met
- **Low** — all markers green and no open care gaps

The Panel Risk Score is never stored — it is recomputed on each panel load from the patient's latest labs, vitals, and care gaps. The **Patient Panel** sorts patients **High → Medium → Low** by default.

## Panel Data Endpoint

`GET /api/patients/panel` — a dedicated endpoint that returns a panel-ready payload for all patients owned by the authenticated clinician. The backend fetches each patient's labs, vitals, and care gaps in parallel, runs **Panel Risk Score** logic server-side, and returns a single response. The frontend never calls `/summary` for panel display.

**Response shape per patient:**
```json
{
  "id": "string",
  "name": "string",
  "dob": "string",
  "gender": "string",
  "followup_due": "string | null",
  "risk_score": "high | medium | low",
  "open_care_gap_count": 2,
  "care_gaps": [{ "description": "...", "severity": "high | medium | low" }]
}
```

Patients are returned sorted **high → medium → low** risk, then by `followup_due` ascending within each tier.

## Panel Follow-up Scheduling

An inline action on a **Patient Panel** row that lets the clinician set or update a patient's **Follow-up Due Date** without navigating away from the panel. Clicking "Schedule Follow-up" expands a compact date picker within the patient row. Saving calls the existing `PATCH /api/patients/:id/followup-due` endpoint and updates the panel row in place.

Distinct from the follow-up date picker in the **Visit Note panel** on the **Patient Hub**: that picker is shown during an active encounter; the Panel Follow-up Scheduling action is used between encounters when reviewing the panel.

## Panel Lab Order

An action triggered from the **Patient Panel** when the clinician clicks "Order Labs" on a patient row. Pre-populates a **Draft Note** for that patient with a pre-filled **Order Block** derived from any open Lab Test **Care Gaps**, then navigates to that patient's **Patient Hub**. The clinician reviews and edits the draft in the Visit Note panel before saving — identical flow to "Add to note" on an **Action Recommendation**.

No new FHIR resources are created. The order exists only as text within the saved Visit Note.

## Outreach Message

A short AI-generated plain-language message (1–2 paragraphs) produced on demand from the Patient Panel when a clinician clicks the outreach action on a patient row. Intended to be copied and pasted into an external communication tool (patient portal, EHR messaging, etc.) — the app does not send it. Content is derived from the patient's open Care Gaps and Panel Risk Score; no PHI appears in the generated text visible to the user in transit.

**Trigger:** "Outreach" button on a Patient Panel row. Calls `POST /api/patients/:id/generate-outreach-message`. Opens a read-only modal with a copy-to-clipboard button. The message is **never saved** to FHIR.

**Distinct from Post-Visit Patient Report:** a Post-Visit Patient Report summarises a completed encounter and is saved to the longitudinal record. An Outreach Message is a proactive reminder generated between visits and is ephemeral.

## Patient Panel

A population-level view of **all patients assigned to the authenticated clinician**, surfaced at `/panel`. Distinct from and parallel to the **Patients Page** — the Patients Page is a lookup tool (search by name or phone); the Patient Panel is an unsolicited, urgency-sorted view designed to answer the question *"who needs attention today?"* without requiring the clinician to already know who to search for.

Patients are grouped and sorted by **Panel Risk Score** and displayed with their open Care Gaps. The panel is the entry point for proactive outreach, lab ordering, and follow-up scheduling actions — see **Panel Risk Score**, **Outreach**, **Panel Lab Order**, and **Follow-up Scheduling**.

## Post-Visit Patient Report

A plain-language summary of an encounter generated by AI from the saved Visit Note, any Order Blocks appended during the visit, the current medications list, and the Follow-up Due Date. Reviewed and approved by the clinician before being stored permanently in FHIR — no email delivery.

**Trigger:** A **"Generate Patient Summary"** button appears in the Visit Note panel after the Visit Note is saved.

**Preview modal:** Clicking the button calls `POST /api/patients/:id/generate-patient-summary` and opens a modal displaying the AI-generated plain-language text. The clinician may edit the text. Clicking **"Save to Record"** saves it to FHIR.

**FHIR storage:** Saved as a `DocumentReference` with:
- `meta.tag`: `{ system: "patient-mgmt-app", code: "patient-report" }` — distinguishes from Visit Notes (`code: "visit-note"`)
- `type`: LOINC `34133-9` ("Summary of episode note")
- `subject`: `Patient/{patient_id}`
- `content`: base64-encoded plain-language text (exactly as reviewed and approved by the clinician)
- `date`: timestamp of save

The stored DocumentReference is part of the longitudinal patient record. It appears in the **Previous Visit Notes** section of the Patient Hub alongside clinical Visit Notes, with a **"Patient summary"** badge to distinguish it from Visit Notes.
