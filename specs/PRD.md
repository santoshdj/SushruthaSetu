# PRD: Patient Management App — Clinician-Facing Unified Patient Dashboard

**Date:** 2026-05-14  
**Updated:** 2026-05-15 — Phase 2: Patient Registration & Management  
**Updated:** 2026-05-16 — Phase 3: Authentication & Role-Based Access Control  
**Updated:** 2026-05-19 — Phase 4: Visit Notes & Clinical Note History  
**Updated:** 2026-05-20 — Phase 5: AI Action Recommendations  
**Status:** Ready for Implementation

---

## Problem Statement

Outpatient clinicians — PCPs and specialists — spend a significant portion of each patient encounter hunting for information scattered across multiple disconnected systems: the EHR for notes and problem lists, a separate lab portal for recent results, a PACS viewer for imaging, Surescripts for medication fills, and a care gap dashboard buried somewhere else. Before walking into an exam room, a clinician must mentally stitch together a coherent picture of a patient from 4–6 different interfaces.

This fragmentation wastes time, increases cognitive load, and introduces risk: a critical abnormal lab or an overdue preventive screening can be missed simply because it lives in a system the clinician didn't have time to check.

---

## Solution

A single, schedule-driven web application that gives outpatient clinicians one place to see everything they need about a patient before walking into the room. The clinician opens the app, sees today's appointment schedule, clicks a patient, and is presented with an AI-generated pre-visit summary alongside a structured dashboard of clinical data — problems, medications, allergies, vitals, labs, visit history, and care gaps — all pulled from a FHIR-compliant data source and rendered in a clean, card-based layout.

---

## User Stories

1. As a clinician, I want to open the app and immediately see today's scheduled appointments, so that I can quickly navigate to the patient I need to prepare for.
2. As a clinician, I want appointments displayed with patient name, appointment time, and visit reason, so that I can orient quickly without opening each record.
3. As a clinician, I want to click a patient on the schedule and land directly on their summary dashboard, so that I don't have to search or navigate through menus.
4. As a clinician, I want an AI-generated pre-visit summary to appear automatically when I open a patient's record, so that I get a concise narrative of the most important things to know before the visit.
5. As a clinician, I want the pre-visit summary to include recent clinical changes, active concerns, and pending items, so that I arrive at the visit already oriented rather than reading through years of notes.
6. As a clinician, I want to see a patient's active problem list on their dashboard, so that I have a clear view of their current diagnoses without opening the full EHR.
7. As a clinician, I want to see the patient's current medication list with relevant details, so that I can quickly review what they are taking before discussing adherence or side effects.
8. As a clinician, I want to see documented allergies and adverse reactions prominently displayed, so that I can avoid unsafe prescribing decisions.
9. As a clinician, I want to see the patient's most recent vitals, so that I can identify trends like worsening hypertension or weight change before the encounter.
10. As a clinician, I want to see recent lab results with abnormal values flagged visually, so that I can immediately identify results that need attention.
11. As a clinician, I want to see a summary of past visit notes and encounter history, so that I can understand the continuity of care without reading every note in full.
12. As a clinician, I want to see care gaps and preventive alerts for each patient, so that I can address overdue screenings or missing immunizations during the visit.
13. As a clinician, I want care gap alerts to explain why they are flagged (e.g., "HbA1c overdue — last checked 14 months ago"), so that I understand the clinical context without additional lookup.
14. As a clinician, I want each dashboard section to be an expandable card, so that I can get a quick at-a-glance overview and drill into whichever section needs my attention.
15. As a clinician, I want the pre-visit AI summary card positioned at the top of the dashboard, so that it is the first thing I see when I open a patient record.
16. As a clinician, I want the app to load structured data sections immediately while the AI summary generates in the background, so that I can begin reviewing clinical data without waiting for the LLM response.
17. As a clinician, I want a visual loading indicator on the AI summary card while it is generating, so that I know the system is working and not frozen.
18. As a clinician, I want the dashboard to clearly indicate the source and timestamp of each data element, so that I can assess how current the information is.
19. As a clinician, I want to navigate back to the daily schedule from a patient record with a single click, so that I can move efficiently between patients.
20. As a clinician, I want the app to work in a standard browser without requiring software installation, so that I can access it from any workstation in the clinic.
21. As a clinician, I want the interface to be readable on a standard clinical workstation monitor, so that I don't need to scroll excessively to see the full summary.
22. As a clinician, I want care gap rules to evaluate against the patient's actual clinical data, so that alerts are meaningful and not generic reminders.
23. As a clinician, I want to see whether a care gap alert has a severity level (high / medium / low), so that I can prioritize which gaps to address during a limited appointment.
24. As a developer/administrator, I want the FHIR server base URL and auth token to be configurable via environment variables, so that the app can be pointed at different environments (sandbox, staging, production) without code changes.
25. As a developer/administrator, I want the application to be runnable via Docker Compose with a single command, so that setup is reproducible across machines.

### Phase 2: Patient Registration & Management

26. As a user, I want a dedicated "Patients" page accessible from the top navigation bar, so that I can manage the patient registry independently of the daily schedule.
27. As a user, I want to see a paginated list of all patients on the FHIR server showing name, gender, and date of birth, so that I can browse and locate any patient in the system.
28. As a user, I want the patient list to show 20 patients per page with Previous and Next controls, so that I can navigate large datasets without loading everything at once.
29. As a user, I want to search for patients by name using a search box, so that I can quickly find a specific patient without paging through the full list.
30. As a user, I want the name search to query the entire patient registry (not just the current page), so that I never miss a patient who happens to be on a different page.
31. As a user, I want search results to update automatically as I type (debounced), so that I don't need to press Enter or click a search button.
32. As a user, I want to create a new patient by clicking a "New Patient" button on the Patients page, so that I can register patients who are not yet in the system.
33. As a user, I want the create patient form to open in a modal dialog, so that I stay in context on the Patients page without a full navigation away.
34. As a user, I want the create patient form to collect: First Name, Last Name, Title/Prefix, Gender, and Date of Birth, so that the essential demographic record is captured.
35. As a user, I want First Name and Last Name to be required fields, so that every patient record has a searchable name.
36. As a user, I want Gender to be a dropdown restricted to: Male, Female, Other, Unknown, so that the value is always valid for the FHIR server.
37. As a user, I want Date of Birth to be a date picker in YYYY-MM-DD format, so that the value matches the FHIR date type exactly.
38. As a user, I want to see an inline validation error if I submit the form with a Date of Birth in the future, so that I can correct the entry before it reaches the server.
39. As a user, I want to see an inline validation error if I submit the form with a Date of Birth before 1900-01-01, so that implausible dates are caught early.
40. As a user, I want to see an inline validation error if I submit the form with a required field empty, so that I know exactly which field needs to be filled.
41. As a user, I want the Title/Prefix field to be optional and free-text (e.g., Dr., Mr., Ms.), so that I can record professional or personal titles without being forced to enter one.
42. As a user, I want the new patient to appear in the patient list immediately after I save, so that I can confirm the record was created without manually refreshing.
43. As a user, I want to edit an existing patient by clicking an "Edit" button on their row in the patient list, so that I can correct or update demographic information.
44. As a user, I want the edit form to open in a modal dialog pre-populated with the patient's current values, so that I only need to change the fields that need updating.
45. As a user, I want the same validation rules applied on the edit form as on the create form, so that invalid data cannot be saved on update either.
46. As a user, I want the patient list to refresh automatically after a successful edit, so that the updated values are reflected immediately.
47. As a user, I want to see a success notification after creating or editing a patient, so that I know the save operation completed successfully.
48. As a user, I want to see a clear error message if the save operation fails (e.g., FHIR server error), so that I know the record was not saved and can try again.

### Phase 3: Authentication & Role-Based Access Control

49. As a user, I want to be presented with a login screen when I first open the app, so that only authorised users can access patient data.
50. As a user, I want to log in with my email and password via a login form embedded in the app, so that I don't get redirected to an external authentication page.
51. As a user, I want to be redirected to the schedule page automatically after a successful login, so that I can start my workflow immediately.
52. As a user, I want to be redirected to the login page if I try to access any protected route while unauthenticated, so that unauthorised access is prevented.
53. As a user, I want to remain logged in across page refreshes and browser tab reopens, so that I don't have to log in repeatedly during a work session.
54. As a user, I want a visible "Sign Out" option in the navigation bar, so that I can explicitly end my session.
55. As a clinician, I want to see the schedule and patient dashboard with full read access, so that I can perform my clinical prep workflow.
56. As a clinician, I want the "New Patient" button and "Edit" actions to be hidden from my view, so that the interface is not cluttered with actions I cannot perform.
57. As an admin, I want full access to all features including creating and editing patients, so that I can manage the patient registry.
58. As an admin, I want to see the "New Patient" button and "Edit" actions on the Patients page, so that I can perform registration tasks.
59. As a user, I want to see a clear "Access Denied" message if I attempt an action I am not authorised to perform, so that I understand why the action failed.
60. As a developer, I want Clerk publishable key configurable via environment variable, so that the same codebase runs against Clerk's development and production environments without code changes.
61. As a developer, I want the backend JWT verification to use Clerk's JWKS endpoint configured via environment variable, so that the backend works identically on local, Vercel, and cloud deployments.
### Phase 4: Visit Notes & Clinical Note History

62. As a clinician, I want to see a "Previous Visit Notes" card on the Patient Dashboard, so that I can review what was documented in prior visits without leaving the dashboard.
63. As a clinician, I want the most recent note displayed by default in the Previous Visit Notes card, so that I don't need to expand the full list for a quick orientation.
64. As a clinician, I want a "Show all N notes" toggle in the Previous Visit Notes card that expands the full list inline, so that I can scroll through the complete note history without navigating away.
65. As a clinician, I want notes displayed in reverse chronological order (newest first), so that the most relevant context is always at the top.
66. As a clinician, I want each note to show a source label — "EHR" for Clinical Notes pulled from FHIR, "This App" for Visit Notes saved in this application — so that I understand the provenance of each entry.
67. As a clinician, I want each note entry to show the note date and full text, so that I have the complete record without truncation.
68. As a clinician, I want a sticky "Current Visit Note" panel fixed to the bottom of the Patient Dashboard viewport, so that I can capture or refer to my note at any point during the encounter regardless of which section of the dashboard I am scrolling through.
69. As a clinician, I want the sticky note panel to be collapsed to a thin bar by default, so that it does not obscure the clinical data cards unless I need it.
70. As a clinician, I want to click the collapsed panel bar to expand it into a full textarea with controls, so that I can open the note surface with a single tap without leaving the dashboard.
71. As a clinician, I want to type freely in the note textarea, so that I can document my observations in any format I choose.
72. As a clinician, I want a microphone toggle button in the note panel that activates live transcription, so that I can dictate my note hands-free during the encounter.
73. As a clinician, I want interim transcription results to appear in the textarea in real time as I speak, so that I can see what the system is capturing without waiting for a final result.
74. As a clinician, I want to edit the transcribed text before saving, so that I can correct any misrecognised words before the note is committed to the record.
75. As a clinician, I want transcription to stop when I toggle the microphone off, so that background noise after I finish speaking is not captured.
76. As a clinician, I want my note text to be automatically saved as a draft in the browser, so that I do not lose what I have typed if I accidentally navigate away or close the tab.
77. As a clinician, I want to see an "Unsaved draft from HH:MM" banner if I return to a patient's dashboard with a draft in progress, so that I am immediately aware there is uncommitted content to review.
78. As a clinician, I want to click "Save Note" to commit the note to the patient's FHIR record, so that it is persisted and visible to future clinicians.
79. As a clinician, I want a "Discard" button to clear the current draft and the browser cache, so that I can start fresh without residual text from a previous interaction.
80. As a clinician, I want both clinicians and admin users to be able to save Visit Notes, so that all authorised staff can document patient interactions.
81. As a developer, I want Visit Notes stored as `DocumentReference` FHIR resources tagged with `{ system: "patient-mgmt-app", code: "visit-note" }`, so that app-authored notes are distinguishable from EHR Clinical Notes and queryable through the same endpoint.

### Phase 5: AI Action Recommendations

82. As a clinician, I want a "✨ Suggest next steps" button in the Visit Note panel, so that I can request AI-generated action recommendations at any point during or after the encounter.
83. As a clinician, I want the button to be disabled when the note textarea is empty, so that I don't trigger an AI call without clinical input to reason over.
84. As a clinician, I want AI-generated recommendations to appear in an "AI Action Recommendations" card on the Patient Dashboard, positioned just below the Pre-Visit Summary card, so that suggestions are visible alongside the clinical context I'm working from.
85. As a clinician, I want recommendations grouped by clinical category — Medications, Lab Tests, Referrals, Follow-up, and Patient Education — so that I can scan directly to the type of action I need.
86. As a clinician, I want each recommendation to show an urgency badge (critical, urgent, or routine) alongside the action text, so that I can immediately identify which items require immediate attention.
87. As a clinician, I want each recommendation to include a brief rationale, so that I understand why the AI is suggesting that action and can make an informed clinical judgement.
88. As a clinician, I want the recommendations card to show a loading state while the AI call is in flight, so that I know the system is working and am not left wondering if I clicked the button.
89. As a clinician, I want the recommendations card to show a clear error message if the AI call fails, so that I know the result is unavailable and can proceed without it.
90. As a clinician, I want the AI to incorporate my current note, the full patient aggregate (problems, medications, allergies, vitals, labs, care gaps), and up to 5 previous visit notes when generating recommendations, so that suggestions are contextually grounded and avoid repeating what is already ordered or prescribed.
91. As a clinician, I want the AI recommendations to be generated only when I explicitly trigger them, so that no AI call is made without my deliberate action.
92. As a developer, I want action recommendations served by a dedicated `POST /patients/{id}/action-recommendations` endpoint that accepts the note text in the request body, so that the pre-visit summary endpoint (which has no note-text input) is not conflated with the action recommendations lifecycle.
---

## Implementation Decisions

### Modules

**Backend (FastAPI)**

- **FHIR Client module** — wraps all FHIR REST calls. Single interface for querying `Patient`, `Appointment`, `Condition`, `MedicationRequest`, `AllergyIntolerance`, `Observation`, `Encounter`, and `Immunization` resources. Reads `FHIR_BASE_URL` and `FHIR_AUTH_TOKEN` from environment. Never hardcodes credentials.
- **Schedule service** — fetches today's `Appointment` resources for the authenticated practitioner. Falls back to a seeded mock schedule (5–8 synthetic appointments) when the FHIR server has no `Appointment` data.
- **Patient summary service** — orchestrates parallel FHIR fetches for all seven data sections for a given patient ID. Returns a structured aggregate object consumed by the dashboard endpoint.
- **Care gap rules engine** — a self-contained module that accepts a patient aggregate and evaluates a fixed set of clinical rules. Returns a list of gap objects with label, severity, and rationale. Initial rules: overdue HbA1c (diabetic patients, >90 days), overdue mammogram (women 40+, >1 year), overdue colorectal screening (50+, >10 years), missing annual flu vaccine, elevated BP with no follow-up Observation.
- **Pre-visit summary service** — accepts the patient aggregate, constructs a clinical prompt, and calls the Anthropic Claude SDK. Returns a summary string. Runs as a separate async endpoint so the frontend can load structured data while the LLM call is in flight.

**Frontend (React + shadcn/ui)**

- **Schedule page** — landing screen showing today's appointments. Each row is clickable and navigates to the patient dashboard.
- **Patient dashboard page** — grid of expandable cards. Uses React Query `useQueries` to fetch all seven data sections in parallel from the FastAPI backend. AI summary card uses a separate query with its own loading state.
- **Card components** — one card component per data section (Problems, Medications, Allergies, Vitals, Labs, Visit History, Care Gaps). Collapsed state shows a summary; expanded state shows full detail.
- **API client module** — thin wrapper around `fetch` that sets the base URL from an environment variable (`VITE_API_BASE_URL`). All React Query hooks import from here.

**Phase 2 additions:**

- **Patients page** — new top-level route (`/patients`) accessible from the global nav bar. Displays the paginated patient list, search box, and "New Patient" button. The Schedule page remains the landing screen (`/`).
- **Top navigation bar** — new shared layout component with "Schedule" and "Patients" nav items. Wraps all pages.
- **Patient list table** — displays columns: Name (family, given, prefix), Gender, Date of Birth. Rows include an "Edit" action button. Pagination controls (Previous / Next, current page indicator) sit below the table.
- **Patient form modal** — shared modal component used for both create and edit. Contains: First Name (required), Last Name (required), Prefix (optional), Gender (required dropdown), Date of Birth (required date picker). Validation powered by React Hook Form + Zod. Pre-populates all fields when opened in edit mode.
- **Patient registration service (backend)** — new FastAPI service responsible for `POST /Patient` (create) and `PUT /Patient/{id}` (update) FHIR calls. Accepts a validated Pydantic model, constructs the full FHIR `Patient` resource, and delegates to the FHIR client module.
- **Patient list service (backend)** — new FastAPI service responsible for `GET /Patient` with `name` search and server-side pagination. Proxies FHIR bundle `next` links to the frontend as opaque page tokens.

**Phase 3 additions:**

- **Clerk integration (frontend)** — the React app is wrapped in `<ClerkProvider>` using `VITE_CLERK_PUBLISHABLE_KEY`. A `/login` route renders Clerk's embedded `<SignIn />` component. A `<ProtectedRoute>` wrapper component in the router config checks `isSignedIn` from Clerk's `useAuth` hook and redirects unauthenticated users to `/login`. The `/login` route redirects already-signed-in users to `/`.
- **`useRole()` custom hook (frontend)** — wraps Clerk's `useUser()` hook, reads `user.publicMetadata.role`, and returns a typed value of `"admin" | "clinician"`. All components that conditionally render admin-only UI elements consume this hook.
- **JWT auth middleware (backend)** — a FastAPI dependency (`get_current_user`) that extracts the `Authorization: Bearer` header, verifies the JWT signature against Clerk's JWKS endpoint (cached on startup), and returns the decoded claims including the user's role. Applied to all protected endpoints.
- **`require_admin` dependency (backend)** — a FastAPI dependency that calls `get_current_user` and raises `HTTP 403` if the role claim is not `"admin"`. Applied to `POST /patients` and `PUT /patients/{id}`.

**Phase 4 additions:**

- **Notes service (backend)** — a new FastAPI service responsible for reading and writing `DocumentReference` FHIR resources scoped to a patient. Fetches both Clinical Notes (any `DocumentReference`) and Visit Notes (tagged with `{ system: "patient-mgmt-app", code: "visit-note" }`). Decodes Base64-encoded content and returns `{ id, date, source, text }` objects. Source is derived from `meta.tag` presence: "This App" if the tag is present, "EHR" otherwise.
- **Notes router (backend)** — two endpoints:
  - `GET /patients/{patient_id}/notes` — returns an array of note objects (both Clinical and Visit Notes) sorted by date descending.
  - `POST /patients/{patient_id}/notes` — accepts `{ text, encounter_date }`, constructs a `DocumentReference` resource with the app tag, and POSTs it to the FHIR server. Accessible by both `clinician` and `admin` roles.
- **`PreviousNotesCard` component (frontend)** — collapsible card on the Patient Dashboard. Shows the most recent note by default. A "Show all N notes" toggle expands the full inline list, each entry showing date, source badge, and full text.
- **`useSpeechRecognition` hook (frontend)** — encapsulates the browser `window.SpeechRecognition` / `window.webkitSpeechRecognition` API. Exposes `{ isListening, isSupported, toggle }` and fires `onResult(finalText)` and `onInterim(text)` callbacks. Keeps the component that consumes it clean of Web Speech API details.
- **`VisitNotePanel` component (frontend)** — sticky bottom panel fixed to the viewport. Collapsed bar by default; expands to a textarea with Dictate, Save Note, Discard, and "✨ Suggest next steps" controls. Debounce-saves draft to `localStorage` under `visit-note-draft-{patient_id}`. Restores draft with unsaved-draft banner on mount. Clears draft on save or discard.

**Phase 5 additions:**

- **Action Recommendations service (backend)** — accepts `(patient_id, note_text)`. Internally fetches the patient aggregate via the summary service and the 5 most recent notes via the notes service. Builds a structured system prompt and calls Claude (`claude-sonnet-4-5`) requesting JSON output in the `{ category, action, urgency, rationale }` shape. Strips markdown fences before parsing. Returns `{ recommendations: [...] }`.
- **Action recommendations endpoint (backend)** — `POST /patients/{patient_id}/action-recommendations`, added to the summary router. Accepts `{ note_text: string }`. Delegates to the action recommendations service.
- **`ActionRecommendationsCard` component (frontend)** — hidden until loading, data, or error state is active. When loading, shows a shimmer skeleton. When populated, groups recommendations by category in the order: Medications → Lab Tests → Referrals → Follow-up → Patient Education. Each recommendation row shows action text, urgency badge (red = critical, orange = urgent, gray = routine), and rationale. Blue-tinted card styling distinguishes it visually from clinical data cards.

### API Contract

Backend exposes the following REST endpoints:

```
GET  /schedule/today              → list of today's appointments
GET  /patients/{id}/summary       → structured aggregate (all 7 sections)
GET  /patients/{id}/ai-summary    → pre-visit AI narrative (returns JSON with bullets array)

GET  /patients?name={term}&_count=20&page_token={token}  → paginated patient list
POST /patients                    → create new patient
PUT  /patients/{id}               → update existing patient

GET  /patients/{id}/notes         → list of DocumentReference notes (Clinical + Visit)
POST /patients/{id}/notes         → create a Visit Note (clinician or admin)

POST /patients/{id}/action-recommendations  → generate AI action recommendations from note text
```

### Data Flow

1. Frontend loads schedule → `GET /schedule/today`
2. Clinician clicks patient → navigate to `/patients/:id`
3. React Query fires `useQueries` for `/patients/{id}/summary`, `/patients/{id}/ai-summary`, and `/patients/{id}/notes` in parallel
4. Structured cards render as `/summary` resolves; AI card shows spinner until `/ai-summary` resolves; Previous Notes card renders as `/notes` resolves
5. Backend `/summary` handler calls FHIR client in parallel for all 7 resources, aggregates, runs care gap rules engine, returns combined JSON
6. Backend `/ai-summary` handler calls Claude with the aggregated patient data as context
7. Clinician types or dictates a visit note; draft auto-saved to `localStorage` on every keystroke (debounced 500ms)
8. Clinician clicks "✨ Suggest next steps" → `POST /patients/{id}/action-recommendations` with current note text
9. Backend action recommendations handler fetches aggregate + 5 recent notes internally, calls Claude, returns categorised JSON
10. `ActionRecommendationsCard` updates with results; clinician reviews and acts on suggestions
11. Clinician clicks "Save Note" → `POST /patients/{id}/notes`; `localStorage` draft cleared; notes list refreshes

### Configuration

- `FHIR_BASE_URL` — FHIR server base URL (no trailing slash)
- `FHIR_AUTH_TOKEN` — Bearer token for FHIR auth (optional; omitted if sandbox requires no auth)
- `ANTHROPIC_API_KEY` — Anthropic SDK key; used by both the pre-visit summary service and the action recommendations service
- `VITE_API_BASE_URL` — Frontend env var pointing at the FastAPI server
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk publishable key (safe to expose in browser)
- `CLERK_JWKS_URL` — Clerk JWKS endpoint, e.g. `https://{clerk-domain}/.well-known/jwks.json`
- `CLERK_ISSUER` — Clerk issuer URL, e.g. `https://{clerk-domain}`

All environment variables are managed via `.env.local` for local development (gitignored) and platform-native env var UI (Vercel dashboard, AWS Parameter Store, Railway, etc.) for cloud deployments. A `.env.example` file with placeholder values is committed to the repo.

### Infrastructure

- Docker Compose with two services: `backend` (FastAPI via uvicorn) and `frontend` (Vite dev server or nginx-served build)
- Local dev: `uvicorn app.main:app --reload` + `npm run dev` in separate terminals

---

## Testing Decisions

**What makes a good test:** Tests should verify external behavior observed through the module's public interface, not implementation details. A test should not break when internal implementation is refactored.

**Modules to test:**

- **Care gap rules engine** — highest priority. Pure function: takes a patient aggregate, returns gap list. Easily testable in isolation with synthetic patient fixtures. Cover each rule's positive (gap present) and negative (gap not present) cases.
- **Patient summary service** — test that FHIR resources are correctly mapped into the aggregate schema. Mock the FHIR client; assert on the shape of the returned aggregate.
- **Schedule service** — test the mock fallback activates when FHIR returns an empty Appointment bundle.
- **Pre-visit summary service** — test that the correct prompt structure is sent to Claude. Mock the Anthropic SDK; assert on prompt content and that the return value is a non-empty string.
- **Patient registration service** — test that `POST /patients` constructs a valid FHIR `Patient` resource and calls the FHIR client with the correct payload. Test that `PUT /patients/{id}` includes the correct `id` in the resource body. Mock the FHIR client; assert on the outbound resource shape. Cover all validation error cases (future DOB, pre-1900 DOB, missing required fields, invalid gender value).
- **Patient list service** — test that `GET /patients` correctly passes `name` and `_count` parameters to the FHIR client. Test that pagination tokens are correctly proxied.
- **JWT auth middleware** — test that a valid JWT passes verification and returns decoded claims. Test that an expired token returns 401. Test that a missing `Authorization` header returns 401. Test that a token with a valid signature but wrong issuer returns 401. Mock the JWKS fetch.
- **`require_admin` dependency** — test that a JWT with `role: "admin"` passes. Test that a JWT with `role: "clinician"` returns 403. Test that `POST /patients` and `PUT /patients/{id}` return 403 for clinician JWTs.
- **Notes service** — test that `GET /patients/{id}/notes` returns a correctly shaped list of note objects, with EHR and "This App" source labels correctly derived from `meta.tag`. Test that `POST /patients/{id}/notes` constructs a valid `DocumentReference` resource body with the expected tag and Base64-encoded content. Mock the FHIR client for both.
- **Action recommendations service** — test that the prompt passed to Claude includes the note text, the patient aggregate, and the content of previous notes. Test that markdown fences are stripped before JSON parsing. Test that the response is correctly shaped as `{ recommendations: [{category, action, urgency, rationale}] }`. Mock the Anthropic SDK and the summary/notes services.
- **Action recommendations endpoint** — integration test via `TestClient`: assert `POST /patients/{id}/action-recommendations` with a valid note text returns 200 and a correctly shaped JSON body. Assert that missing or empty `note_text` returns a 422 validation error.
- **API endpoints** — integration-style tests using FastAPI's `TestClient`. Assert on HTTP status codes and response shapes for all endpoints including `/patients`, `POST /patients`, and `PUT /patients/{id}`. Include auth header in all test requests using a mock JWT fixture.

**Prior art:** The `resume-analyzer-agent` test suite (pytest + `TestClient`) provides the pattern for FastAPI endpoint testing in this workspace.

---

## Out of Scope

- **SMART on FHIR OAuth2** — the app uses Clerk for application-level auth, not FHIR-native SMART on FHIR. SMART on FHIR is a future consideration for production EHR integration.
- **Patient delete / deactivate** — no mechanism to remove or deactivate patient records in this phase
- **Write operations beyond demographics** — no ordering, prescribing, note authoring, or editing of clinical data (conditions, medications, etc.)
- **Imaging / PACS** — radiology images and DICOM viewer are not included
- **Real EHR integration** — the app targets a synthetic FHIR sandbox; production EHR certification and vendor-specific API quirks are post-MVP
- **Multi-practitioner / multi-clinic** — the schedule assumes a single practitioner context; no user management
- **Natural language Q&A** — free-text querying of patient data is a future feature
- **Proactive drug interaction or allergy alerts** — clinical decision support rules beyond care gap detection are out of scope
- **Action recommendations persistence** — recommendations are transient and are not saved to the FHIR record or any database. Persisting recommendations per visit is a future phase.
- **One-click order from recommendation** — future enhancement. The structured recommendation shape (`category`, `action`, `urgency`, `rationale`) is designed to support this, but no ordering/prescribing write path is implemented.
- **Server-side transcription** — Whisper, AssemblyAI, or any other server-side transcription service is out of scope. The Web Speech API browser implementation is used exclusively. Firefox and Safari support is deferred.
- **Mobile / responsive design** — the app targets clinical workstation monitors; mobile optimization is not required for MVP
- **Audit logging and HIPAA compliance** — the app uses synthetic data only; compliance controls are post-MVP
- **Advanced patient demographics** — phone, address, insurance, emergency contacts, and other extended demographics are out of scope for the patient form

---

## Further Notes

- The `Clinical-notes-summarizer` project in this workspace contains prior Anthropic SDK integration work that should be referenced when implementing the pre-visit summary service.
- The FHIR `Appointment` resource is one of the less consistently implemented resources across sandbox servers. The seeded mock fallback ensures the schedule screen is always functional regardless of sandbox coverage.
- Care gap rules should be implemented as a registry of small, independently-testable rule functions rather than a single monolithic evaluator, so new rules can be added without modifying existing logic.
- The pre-visit summary prompt should include structured context from all seven data sections, not just clinical notes, to give Claude sufficient signal for a meaningful summary.
- Clerk provides separate key sets per environment (development vs. production) in the dashboard. Local dev uses Clerk dev keys; cloud deployments use production keys. No code changes are needed between environments — only env var values differ.
- The `get_current_user` FastAPI dependency must cache Clerk's JWKS response and refresh it on a TTL basis. For containerized deployments the cache persists in memory; for serverless deployments a short TTL re-fetch on cold start is acceptable.
- The `useRole()` hook should return a safe default (`"clinician"`) if `publicMetadata.role` is absent, ensuring the app fails closed (read-only) rather than open.
- The patient form modal is a shared component: the same React component handles both create (blank form) and edit (pre-populated form), differentiated by whether a patient ID is passed as a prop. This keeps validation logic and field definitions in one place.
- FHIR server-side name search behaviour varies by implementation: HAPI FHIR supports prefix matching on `family` and `given` via the `name` parameter. The backend should document which FHIR search parameter is used so that behaviour differences across servers are not surprising.
- The `PUT /patients/{id}` endpoint performs a full resource replace. The backend must reconstruct the complete FHIR `Patient` resource (including the `id` field) before sending — it must not send only the changed fields.
- The `DocumentReference` FHIR resource stores note content as Base64-encoded UTF-8 plain text in `content[0].attachment.data`. The backend notes service encodes on write and decodes on read; the frontend never handles Base64.
- The Medblocks sandbox is a shared, public FHIR server. All `DocumentReference` resources created by the app are visible to other sandbox users. This is acceptable for synthetic/demo notes but not for real PHI. A private FHIR server or a local database must replace the sandbox before the app handles real patient data.
- The `localStorage` draft key is `visit-note-draft-{patient_id}`, making drafts per-patient and per-browser. Drafts are silently cleared on save or explicit discard. No server-side draft synchronisation is implemented.
- The action recommendations prompt instructs Claude to return only valid JSON (no markdown fences). The service also strips any fences defensively, mirroring the approach used in the pre-visit summary service.
- The five-note cap on longitudinal context for action recommendations is a token-cost control decision. If summaries become long, this cap may need to be lowered. A higher cap or full-history retrieval should not be introduced without a token-cost analysis.
- The `ActionRecommendationsCard` is hidden entirely (returns `null`) when neither loading, error, nor data are present, keeping the dashboard clean before the clinician triggers the feature for the first time.
