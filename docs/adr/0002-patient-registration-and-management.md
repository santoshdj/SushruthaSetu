# ADR 0002: Patient Registration & Management Feature

**Date:** 2026-05-15  
**Status:** Accepted  
**Deciders:** Product owner (via design interview, 2026-05-15)  
**Supersedes:** Partial supersession of ADR 0001 Decision 11 ("The app is read-only for MVP")

---

## Context

ADR 0001 established the Patient Management App as a read-only, schedule-driven clinician dashboard. A second feature phase introduces patient registration capabilities: listing all patients on the FHIR server, searching by name, creating new patients, and editing existing patient demographics. This feature transitions the app from purely read-only to supporting write operations on `Patient` resources.

All decisions in this ADR were made during a structured design interview on 2026-05-15.

---

## Decisions

### 1. Actor: Same User for MVP (No Role Distinction)

**Decision:** The create and edit operations are accessible to the same user who uses the clinician dashboard. No role-based access control is implemented for MVP.

**Rationale:** The app has no authentication layer (see ADR 0001). Enforcing a role distinction without auth is theatre. The conceptual intent is that patient creation and editing is a registration/front-desk workflow, not a clinical workflow — this distinction must be enforced when auth is added in a future phase.

**Future implication:** When SMART on FHIR OAuth2 is implemented, create and edit operations should be restricted to a `registration` or `admin` role. Clinicians should retain read-only access.

---

### 2. Navigation: Separate "Patients" Page with Top-Level Nav Bar

**Decision:** A new top-level route (`/patients`) is added for the patient registry. A persistent top navigation bar is introduced with two items: "Schedule" (the existing landing screen) and "Patients" (the new registry page). The schedule screen remains the default landing route (`/`).

**Rationale:** The schedule and the patient registry serve different workflows and different (future) roles. Merging them or replacing the schedule screen would degrade the clinician experience that was the original design goal. A top nav bar is the lowest-friction way to add a second primary destination.

---

### 3. Patient List: Server-Side Pagination via FHIR Bundle Links

**Decision:** The patient list fetches `GET /Patient?_count=20` from the FHIR server via the FastAPI backend. The FHIR bundle's `next` relation link is proxied to the frontend as an opaque page token. The frontend sends this token back to retrieve subsequent pages. Previous/Next controls are shown below the table with a current page indicator.

**Rationale:** FHIR's native bundle pagination (`next`/`previous` links) is the correct mechanism for paging large `Patient` datasets. Client-side pagination (fetch all, slice in the browser) would fail on any realistically sized server. Page size of 20 matches HAPI FHIR's default and is a comfortable density for a clinical workstation display.

---

### 4. Name Search: FHIR Server-Side via `name` Search Parameter

**Decision:** The search box on the Patients page sends the search term to the backend, which appends it as the `name` query parameter on the FHIR `Patient` search call (`GET /Patient?name={term}&_count=20`). Results replace the current list. Search is debounced on the frontend (triggered after a short pause in typing). Clearing the search box reverts to the full unfiltered list.

**Rationale:** Server-side search queries the entire patient registry, not just the currently loaded page. A client-side filter on 20 rows would miss patients on other pages and would not be fit for purpose. FHIR's `name` parameter performs prefix matching across both `family` and `given` name components on HAPI FHIR.

**Note:** FHIR name search behaviour varies by server implementation. The backend must document which FHIR parameter is used so that differences across servers are visible.

---

### 5. Patient Form Fields

**Decision:** The create and edit form collects exactly these fields:

| Field | FHIR Mapping | Required |
|---|---|---|
| First Name | `Patient.name[0].given[0]` | Yes |
| Last Name | `Patient.name[0].family` | Yes |
| Title / Prefix | `Patient.name[0].prefix[0]` | No |
| Gender | `Patient.gender` | Yes |
| Date of Birth | `Patient.birthDate` | Yes |

**Rationale:** These are the three fields specified in the product requirements (name, gender, DOB), expanded to split name into its FHIR-correct structural components. Prefix is added as the one optional extension that is clinically common (Dr., Mr., Ms.) without adding form complexity. No additional demographics (phone, address, insurance) are in scope for this phase.

---

### 6. Gender Values: FHIR R4 Fixed Value Set

**Decision:** The gender dropdown is restricted to exactly four values as defined by the FHIR R4 `administrative-gender` value set: `male`, `female`, `other`, `unknown`. No mapping layer is introduced. The value sent to the FHIR server is the raw FHIR code.

**Rationale:** Using FHIR's value set directly guarantees round-trip correctness without a mapping layer. Any richer gender representation (e.g., non-binary, prefer not to say) would require mapping to one of these four FHIR codes, introducing ambiguity and potential data loss. A more expressive gender model is a future consideration, likely requiring FHIR extensions.

---

### 7. Date of Birth Validation Rules

**Decision:** The Date of Birth field enforces the following rules, evaluated on both the frontend and backend:

- Required — cannot be empty
- Valid date — must parse as a calendar date
- Not in the future — must be ≤ today's date
- Not implausibly old — must be ≥ 1900-01-01

The field uses a date picker component that produces a `YYYY-MM-DD` string, matching FHIR's `date` type exactly. No time component is included.

**Rationale:** A DOB in the future is a data entry error. A DOB before 1900 is implausible for a living patient and typically indicates a default value or typo. Both rules are cheap to enforce and prevent silent bad data from reaching the FHIR server. Using FHIR's `date` type (`YYYY-MM-DD`) avoids timezone ambiguity.

---

### 8. Frontend Validation: React Hook Form + Zod

**Decision:** The patient form uses React Hook Form for form state management and Zod for schema-based validation. Validation errors are displayed inline below each field. The form cannot be submitted while validation errors are present.

**Rationale:** React Hook Form minimises re-renders and handles form state efficiently. Zod defines all validation rules in a single schema object, making it easy to audit and modify the rule set. The combination is the current industry standard for React forms and produces clean, field-level error messages without manual wiring.

---

### 9. Backend Validation: Pydantic Models

**Decision:** The FastAPI backend validates all incoming create and edit payloads using Pydantic models before forwarding to the FHIR client. The backend applies the same rules as the frontend (required fields, DOB range, gender value set). Invalid payloads return HTTP 422.

**Rationale:** Frontend validation is a UX convenience; backend validation is a correctness guarantee. The server must never trust the client. Pydantic integrates natively with FastAPI and produces structured error responses that the frontend can display if needed.

---

### 10. Create/Edit UX: Shared Modal Dialog

**Decision:** Both create and edit operations open the same modal dialog component. The "New Patient" button opens it with blank fields. Each row's "Edit" button opens it pre-populated with the patient's existing values fetched from the FHIR resource. On successful save, the modal closes and the patient list refetches.

**Rationale:** A modal keeps the user on the Patients page without a navigation event. A shared component means the form's validation schema, field definitions, and submit handler live in one place. Pre-populating the edit form reduces re-entry effort and the risk of accidentally blanking a field.

**Alternative rejected:** A separate `/patients/{id}/edit` route — adds a navigation step, complicates the back-button behaviour, and duplicates the form component for no benefit at this scale.

---

### 11. FHIR Write Operations: POST for Create, PUT for Update

**Decision:** Patient creation uses `POST /Patient` (server-assigned ID). Patient update uses `PUT /Patient/{id}` (full resource replace). The `PATCH` operation is not used.

**Rationale:** `POST` and `PUT` are universally supported in FHIR R4 servers including HAPI FHIR. `PUT` requires sending the complete `Patient` resource — the backend reconstructs the full resource from the form payload plus the existing `id` before sending. `PATCH` support is inconsistent across FHIR servers and is not needed when the form captures the full demographic record.

---

### 12. Post-Save List Update: React Query Cache Invalidation

**Decision:** After a successful create or edit, the frontend calls `queryClient.invalidateQueries(['patients'])`, triggering a full refetch of the patient list from the backend. A success toast notification is shown. On error, an error notification is shown and the modal remains open.

**Rationale:** Cache invalidation is a one-liner and guarantees the list reflects the server's current state. Optimistic updates (updating the cache before the server confirms) would add meaningful complexity for an admin workflow where write frequency is low and consistency matters more than perceived latency.

---

## Consequences

- The app is no longer fully read-only. The FHIR client module must be extended to support `POST` and `PUT` in addition to the existing `GET` operations.
- A new top nav bar component must wrap all existing pages. The Schedule page and Patient Dashboard page should not need changes beyond being wrapped in the new layout.
- The patient registration service is a new backend module, distinct from the patient summary service (which fetches clinical data for the dashboard). These must not be conflated.
- When authentication is added, the `POST /patients` and `PUT /patients/{id}` endpoints must be restricted to a registration/admin role. The existing read endpoints should remain accessible to clinicians.
- The `PUT /Patient/{id}` full-replace behaviour means the backend must fetch the existing patient resource before updating, or the frontend must supply all fields. The current design (form captures all fields) makes the fetch-before-update unnecessary — but this assumption must be documented so future field additions don't silently drop existing data.
