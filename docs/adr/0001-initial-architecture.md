# ADR 0001: Initial Architecture — Patient Management App

**Date:** 2026-05-14  
**Status:** Accepted  
**Deciders:** Product owner (via design interview, 2026-05-14)

---

## Context

The Patient Management App is a greenfield project. All architectural decisions were made during a structured design interview prior to any code being written. This ADR records the full set of foundational decisions so that future contributors understand the reasoning behind the initial structure and do not need to re-litigate settled choices.

---

## Decisions

### 1. Target User: Outpatient PCP / Specialist

**Decision:** The primary user is an outpatient primary care physician or specialist in a clinic setting.

**Rationale:** The information fragmentation problem is worst in outpatient care, where clinicians move rapidly between patients and typically lack a dedicated team to consolidate information for them. Inpatient workflows (hospitalists, nursing) have meaningfully different tooling requirements and are deferred to a future phase.

---

### 2. Primary Navigation: Schedule-First

**Decision:** The landing screen is the clinician's daily appointment schedule, not a patient search.

**Rationale:** The schedule matches the outpatient clinician's primary mental model — "I have N patients today, let me prepare for the next one." It reduces clicks for the most common workflow, eliminates the need to know or type a patient MRN, and makes the app feel purpose-built for clinical prep rather than a generic record browser.

---

### 3. Patient Dashboard Layout: Card Grid with Expandable Cards

**Decision:** The patient detail view is a responsive card grid. Each of the seven data sections is a card. The AI pre-visit summary card is always positioned at the top. Cards can be expanded in place to reveal full detail.

**Rationale:** A card grid gives the clinician an at-a-glance overview of all sections on a single screen without scrolling. It mirrors the "Storyboard" pattern established by Epic and familiar to most clinicians. Collapsed cards show the most critical data points (e.g., medication count, flagged lab values); expanded cards show the full list.

---

### 4. Data Source: FHIR R4 via Synthetic Sandbox

**Decision:** All clinical data is sourced from a FHIR R4-compliant server. For the MVP, this is the developer's existing synthetic FHIR sandbox. The server base URL and auth token are injected via environment variables (`FHIR_BASE_URL`, `FHIR_AUTH_TOKEN`).

**Rationale:** FHIR R4 is the mandated interoperability standard under the 21st Century Cures Act. Building against FHIR from the start ensures the integration path to real EHRs (Epic, Cerner, Athena) is a configuration change, not a rewrite. A synthetic sandbox eliminates PHI concerns during development.

---

### 5. Seven MVP Data Sections

**Decision:** The patient dashboard displays exactly these seven sections for MVP:
1. Active Problems / Diagnoses (`Condition` resource)
2. Current Medications (`MedicationRequest` resource)
3. Allergies (`AllergyIntolerance` resource)
4. Recent Vitals (`Observation` resource, vital signs category)
5. Lab Results (`Observation` resource, laboratory category)
6. Visit History (`Encounter` + `DocumentReference` resources)
7. Care Gaps / Preventive Alerts (rule-based, see Decision 8)

**Rationale:** These are the six clinical data categories a PCP reviews before every outpatient encounter, plus care gaps, which directly support the preventive care workflow that is uniquely well-suited to a pre-visit tool. Demographics, imaging, referrals, and pending orders are deferred to phase 2.

---

### 6. Tech Stack: React + shadcn/ui Frontend, FastAPI Backend

**Decision:** The frontend is React with shadcn/ui as the component library. The backend is Python FastAPI. The two are deployed as separate services in a monorepo.

**Rationale:** 
- FastAPI matches the conventions already established across this workspace (resume-analyzer-agent, Clinical-notes-summarizer). It provides async support needed for parallel FHIR fetches and a clean separation between FHIR data retrieval and UI concerns.
- shadcn/ui produces a clean, neutral clinical aesthetic with accessible components (tables, cards, badges for alert severity) without heavy customization effort.
- Keeping frontend and backend separate allows independent scaling and a clean API contract.

---

### 7. AI Feature: Auto-Generated Pre-Visit Summary via Anthropic Claude

**Decision:** When a clinician navigates to a patient record, the backend automatically constructs a structured prompt from all seven data sections and calls the Anthropic Claude API. The resulting narrative summary is displayed in the top card of the dashboard.

**Rationale:** The pre-visit summary is the highest-value AI feature because it directly addresses the core problem (information synthesis across sources) in a low-risk way (the clinician still sees all underlying data). Auto-triggering on patient select avoids an extra click and surfaces the feature prominently. Claude's long-context capability and strength at clinical reasoning make it the best fit. Prior Anthropic SDK integration exists in the `Clinical-notes-summarizer` project in this workspace.

**Alternatives rejected:**
- *On-demand button trigger* — hides the primary differentiating feature behind a click; undersells the product.
- *Pre-generate for all day's patients* — wastes LLM calls on no-shows; adds latency at schedule load time.
- *OpenAI GPT-4o* — reasonable alternative, but the team has more prior art with Anthropic in this workspace.

---

### 8. Care Gap Detection: Rule-Based Backend Logic

**Decision:** Care gaps are computed by a dedicated backend module that evaluates a registry of clinical rules against the patient's FHIR data. Initial rules:
1. HbA1c overdue (diabetic patient, no `Observation` of LOINC 4548-4 in last 90 days)
2. Mammogram overdue (female patient, age ≥ 40, no relevant `Observation`/`Procedure` in last 12 months)
3. Colorectal screening overdue (patient age ≥ 50, no relevant screening in last 10 years)
4. Annual flu vaccine missing (no `Immunization` for influenza in current flu season)
5. Unaddressed elevated BP (latest systolic `Observation` > 140, no follow-up encounter in last 30 days)

**Rationale:** Rule-based logic against real FHIR data is more clinically meaningful than static demo alerts and more straightforward to implement than FHIR `MeasureReport` (which is overkill for 5 rules). Each rule is an independent, testable function — new rules can be added to the registry without modifying existing logic.

**Alternatives rejected:**
- *FHIR `Flag` / `DetectedIssue` resources* — inconsistently implemented in sandbox servers; creates a hard dependency on sandbox data quality.
- *FHIR `MeasureReport`* — correct long-term approach for HEDIS compliance but excessive complexity for MVP.

---

### 9. Schedule Source: FHIR Appointment + Seeded Mock Fallback

**Decision:** The schedule service first attempts to fetch today's `Appointment` resources from the FHIR server. If the server returns an empty bundle (no appointments found), it falls back to a set of 5–8 seeded synthetic appointments referencing patient IDs known to exist in the sandbox.

**Rationale:** `Appointment` is one of the least consistently implemented FHIR resources in sandbox environments. The fallback guarantees the app's primary landing screen is always functional and demonstrable, regardless of sandbox coverage, while keeping the FHIR-first path for production readiness.

---

### 10. Frontend Data Fetching: React Query (`useQueries`)

**Decision:** All API calls from the frontend are managed via TanStack React Query. The patient dashboard uses `useQueries` to fire all seven section fetches and the AI summary fetch in parallel.

**Rationale:** Seven parallel async data sources with independent loading and error states is exactly the use case React Query was designed for. It eliminates per-card loading/error boilerplate, provides built-in caching (navigating back to a patient does not re-fetch), and makes the AI summary card's separate loading state trivial to implement.

---

### 11. Deployment: Docker Compose Monorepo

**Decision:** The project lives in a single monorepo (`Patient-Management-App/`) with `backend/` and `frontend/` subdirectories. The canonical run method is `docker compose up`. A local dev fallback (`uvicorn` + `npm run dev`) is documented for developers who prefer not to use Docker.

**Rationale:** Docker Compose makes the project self-contained and shareable without setup instructions spanning multiple repositories. The monorepo structure mirrors the conventions in `resume-analyzer-agent` in this workspace.

---

## Consequences

- All FHIR queries must go through the backend's FHIR client module — the frontend never calls FHIR directly. This keeps auth credentials server-side and provides a single point for adding caching, error handling, or rate limiting later.
- The app is read-only for MVP. No write endpoints will be implemented.
- The care gap rules engine is the most business-logic-dense module and has the highest test priority.
- When a real EHR integration is added, the only change required is setting `FHIR_BASE_URL` and `FHIR_AUTH_TOKEN` — no code changes should be needed for the seven core data sections (assuming the EHR is FHIR R4 compliant).
- Auth (SMART on FHIR OAuth2) is explicitly deferred. The app should not be run against systems containing real patient data until auth is implemented.
