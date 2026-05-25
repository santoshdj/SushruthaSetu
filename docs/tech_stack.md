# SushruthaSetu — Technology Stack

**Last updated:** 2026-05-25

---

## Overview

SushruthaSetu is a clinician-facing patient management web application with a React single-page frontend, a FastAPI Python backend, Clerk for authentication, Anthropic Claude for AI features, and a FHIR R4 server (Medblocks) as the sole data store.

---

## Frontend

| Concern | Technology | Notes |
|---|---|---|
| UI framework | **React 18** | Functional components, hooks throughout |
| Language | **TypeScript 5** | Strict mode enabled |
| Build tool | **Vite** | Dev server + production build |
| Routing | **React Router v6** | File-based routes; layout routes for auth and role guards |
| Server state | **TanStack React Query v5** | All API calls; stale-while-revalidate caching |
| Authentication | **Clerk React SDK** | `<ClerkProvider>`, `useAuth`, `useUser`; JWT fetched per request via `getToken()` |
| Styling | **Tailwind CSS v3** | Utility-first; no CSS modules |
| Charts | **Recharts** | LineChart with ReferenceArea/ReferenceLine for vitals and labs trend views |
| Form validation | **React Hook Form + Zod** | Patient registration modal; all form state managed client-side |
| Speech-to-text | **Web Speech API** (`SpeechRecognition`) | Dictation in Visit Note panel; wrapped in `useSpeechRecognition` hook |
| Draft persistence | **`localStorage`** | Visit note drafts keyed by `visit-note-draft-{patient_id}` |
| HTTP client | **`fetch` (native)** | Thin `apiFetchWithAuth` wrapper injects Clerk JWT and `VITE_API_BASE_URL` |
| Path aliases | `@/` → `src/` | Configured in `vite.config.ts` and `tsconfig.json` |

---

## Backend

| Concern | Technology | Notes |
|---|---|---|
| Framework | **FastAPI** (Python 3.12) | Async endpoints; Pydantic v2 models |
| ASGI server | **Uvicorn** | `uvicorn main:app` in Docker; `--reload` for local dev |
| Authentication | **python-jose / PyJWT** | Verifies Clerk RS256 JWTs against JWKS endpoint; `PyJWKClient` cached per hour; 60 s clock-skew leeway |
| HTTP client | **httpx** (sync) | FHIR REST calls; all FHIR I/O through `fhir_client.py` |
| AI / LLM | **Anthropic Python SDK** | `claude-sonnet-4-5`; used for Pre-Visit Summary and Action Recommendations |
| Config | **pydantic-settings** | `Settings` reads all env vars; single `.env` file for local dev |
| FHIR server | **Medblocks** (R4) | `https://fhir.medblocks.com/...`; Bearer token auth; `_tag` search used for patient ownership filtering |
| Dependency injection | FastAPI `Depends` | `get_current_user` → `require_admin` chain |
| Audit events | Fire-and-forget FHIR `AuditEvent` POST | Background daemon thread; failures are logged, never propagated |
| CORS | FastAPI `CORSMiddleware` | `allow_origins=["*"]` (tightened for production via env var) |

---

## Infrastructure & Deployment

| Concern | Technology | Notes |
|---|---|---|
| Containerisation | **Docker** | Separate `Dockerfile` for backend; frontend served by Vite in dev, nginx in prod |
| Local dev orchestration | **Docker Compose** | `docker-compose.yml` in repo root; single `docker compose up` starts both services |
| Backend cloud hosting | **Railway** | `backend/railway.toml`; Dockerfile builder; health check at `/health` |
| Frontend cloud hosting | **Railway / Vercel** | Static build output from `npm run build` |
| Environment variables | `.env.local` (local, gitignored) | Platform env var UI for Railway/Vercel; `.env.example` committed |
| CI/CD | GitHub — manual pushes on `main` | No pipeline yet; deployments triggered via Railway's GitHub integration |

---

## Data Layer

| Concern | Technology | Notes |
|---|---|---|
| Patient data store | **FHIR R4 (Medblocks sandbox)** | Single source of truth for all clinical data and app-authored artefacts |
| FHIR resources used | Patient, Appointment, Condition, MedicationRequest, AllergyIntolerance, Observation (vital-signs + laboratory), DocumentReference, Immunization, AuditEvent | |
| Patient ownership | `Patient.meta.tag` `{ system: "patient-mgmt-app/clinician", code: <clerk_user_id> }` | Enables `_tag` server-side search; see ADR 0007 |
| Visit Notes | `DocumentReference` with `meta.tag { system: "patient-mgmt-app", code: "visit-note" }` | Distinguishes app notes from EHR/Synthea notes |
| Audit Events | `AuditEvent` FHIR resources | Five event types; append-only; written fire-and-forget |
| No relational DB | — | All persistent state lives in the FHIR server |

---

## AI / LLM

| Concern | Technology | Notes |
|---|---|---|
| Model | `claude-sonnet-4-5` (Anthropic) | Used for both Pre-Visit Summary and Action Recommendations |
| SDK | `anthropic` Python package | Synchronous client; called from FastAPI background thread |
| Pre-Visit Summary | 4–5 bullet points ordered by clinical priority | Input: patient aggregate (problems, meds, allergies, vitals, labs, care gaps, last visit) |
| Action Recommendations | Categorised list `{ category, action, urgency, rationale }` | Input: patient aggregate + current note text + 5 most-recent visit notes |
| Output parsing | JSON; markdown fence stripping applied defensively | Prompt instructs model to return raw JSON; fences stripped as fallback |

---

## Authentication & Authorisation

| Concern | Technology | Notes |
|---|---|---|
| Identity provider | **Clerk** | Email/password; JWT issued per session |
| JWT algorithm | **RS256** | Public keys fetched from Clerk JWKS endpoint |
| Role storage | `publicMetadata.role` in Clerk dashboard | Values: `"clinician_user"` (default) or `"clinician_admin"` |
| Role enforcement (backend) | `get_current_user` → `require_admin` FastAPI dependencies | Admin-only: `GET /events`, `POST /admin/seed-clinician-patients` |
| Role enforcement (frontend) | `useUserRole()` hook + `AdminRoute` layout component | Non-admins redirected from `/events`; Events nav link hidden |
| Patient scoping | `clinician_id` derived from `sub` claim; passed to FHIR `_tag` search | Admin bypass: `clinician_id=None` skips filter |

---

## Key Environment Variables

| Variable | Consumer | Purpose |
|---|---|---|
| `FHIR_BASE_URL` | Backend | FHIR server base URL |
| `FHIR_AUTH_TOKEN` | Backend | Bearer token for FHIR auth |
| `ANTHROPIC_API_KEY` | Backend | Anthropic SDK key |
| `CLERK_JWKS_URL` | Backend | Clerk JWKS endpoint |
| `CLERK_ISSUER` | Backend | Clerk issuer URL |
| `VITE_API_BASE_URL` | Frontend | Points frontend at FastAPI server |
| `VITE_CLERK_PUBLISHABLE_KEY` | Frontend | Clerk publishable key (safe to expose) |

---

## Architecture Decisions

See `docs/adr/` for all Architecture Decision Records.

| ADR | Decision |
|---|---|
| [0001](adr/0001-initial-architecture.md) | Monorepo, Docker Compose, FastAPI + React |
| [0002](adr/0002-patient-registration-and-management.md) | Patient CRUD via FHIR REST |
| [0003](adr/0003-authentication-and-authorisation.md) | Clerk JWT, role via `publicMetadata` |
| [0004](adr/0004-visit-notes-and-clinical-note-history.md) | DocumentReference for visit notes |
| [0005](adr/0005-ai-action-recommendations.md) | Claude for action recommendations |
| [0006](adr/0006-cloud-deployment-architecture.md) | Railway deployment |
| [0007](adr/0007-clinician-patient-ownership-via-fhir-metatag.md) | Patient ownership via `meta.tag` (vs extension vs lookup table) |
