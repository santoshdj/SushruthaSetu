# Patient Management App

A practitioner-facing clinical dashboard that gives doctors and clinicians a single place to view patient information, manage patient records, and receive AI-generated pre-visit summaries — without chasing data across multiple systems.

## Features

- **Daily schedule** — today's appointments with one-click patient drill-down; scoped to the logged-in clinician's own patients
- **Patient registry** — search, create, and edit patients backed by a FHIR R4 server; each clinician sees only their own patients
- **Clinical dashboard** — problems, medications, allergies, vitals, labs, visit history, and care gap alerts per patient
- **Latest Vitals panel** — nurse check-in readings displayed at the top of the Patient Hub with HIGH / LOW / ✓ status badges and a "View history" link
- **Vitals History page** — full trend view per vital type with Δ Change table and reference-range chart
- **AI pre-visit summary** — Claude-generated narrative from all 7 clinical sections
- **Visit notes** — dictate or type a note, auto-saved as a draft; saved to FHIR on demand
- **AI action recommendations** — Claude-generated next-step suggestions (medications, labs, referrals, follow-up, education) triggered from the Visit Note panel
- **Role-based access** — `clinician_user` sees only their own patients; `clinician_admin` sees all patients and the full audit Events log
- **Audit trail** — every patient view, create, update, and auth event written as a FHIR `AuditEvent` (fire-and-forget)

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.12+ | Backend runtime |
| Node.js | 20+ | Frontend build and dev server |
| Docker + Docker Compose | v2+ | Optional — for containerised local run |
| [Clerk](https://clerk.com) account | — | Authentication provider (free tier works) |
| [Anthropic](https://console.anthropic.com) API key | — | AI pre-visit summaries |
| FHIR R4 server | — | Defaults to public HAPI FHIR sandbox; bring your own for real data |

---

## Local Development

### 1. Clone and configure

```bash
git clone <repo-url>
cd Patient-Management-App
```

**Backend environment:**

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in:

```env
FHIR_BASE_URL=https://hapi.fhir.org/baseR4   # or your own FHIR server
FHIR_AUTH_TOKEN=                               # leave blank for public HAPI sandbox
ANTHROPIC_API_KEY=sk-ant-...
CLERK_JWKS_URL=https://<your-clerk-domain>/.well-known/jwks.json
CLERK_ISSUER=https://<your-clerk-domain>
```

Your Clerk domain is on the **Clerk Dashboard → Settings → Domains** page (e.g. `clerk.yourapp.dev`).

**Frontend environment:**

```bash
cp frontend/.env.example frontend/.env.local
```

Open `frontend/.env.local` and fill in:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...   # Clerk Dashboard → API Keys
```

---

### 2. Run with Docker Compose (recommended)

```bash
docker compose up --build
```

- Frontend: http://localhost (port 80)
- Backend: http://localhost:8000
- Health check: http://localhost:8000/health

---

### 3. Run without Docker

**Backend:**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend** (in a separate terminal):

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:5173. The Vite dev server proxies `/api/*` requests to `http://localhost:8000` automatically.

---

### 4. Run the test suite

```bash
cd backend
pytest tests/ -v
```

---

### 5. Assign roles in Clerk

User roles are stored in Clerk's **public metadata**. After a user signs up:

1. Go to **Clerk Dashboard → Users**
2. Select the user
3. Click **Metadata → Public** and add one of:

```json
{ "role": "clinician_admin" }
```
```json
{ "role": "clinician_user" }
```

| Role | Capabilities |
|---|---|
| `clinician_user` | Own patients only; schedule scoped to own patients; save visit notes; request AI recommendations |
| `clinician_admin` | All patients; all schedule entries; Events audit log; admin seed endpoint |

Users without a `role` key default to `clinician_user` behaviour.

---

### 6. Seed demo patients (optional)

If you're using a FHIR server that already has patients (e.g. Synthea-generated data), those patients won't have an owner tag and won't be visible to any `clinician_user`. The seed endpoint distributes them automatically:

```bash
curl -X POST http://localhost:8000/admin/seed-clinician-patients \
  -H "Authorization: Bearer <admin_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"clinician_1_id": "<clerk_user_id_1>", "clinician_2_id": "<clerk_user_id_2>"}'
```

- Finds all Patient resources without an ownership `meta.tag`
- Splits them randomly 50/50 between the two Clerk user IDs
- Already-tagged patients are skipped; safe to re-run

---

## Deploying to Railway

[Railway](https://railway.app) can host both the backend and frontend in the same project, making it the simplest end-to-end deployment option. Each service is deployed from the same GitHub repo using a different root directory.

### Prerequisites

- A [Railway](https://railway.app) account (free Hobby tier works for testing)
- The repo pushed to GitHub

---

### Step 1 — Create a Railway project

1. Go to [railway.app](https://railway.app) and click **New Project → Deploy from GitHub repo**.
2. Authorise Railway to access your GitHub account and select this repository.

---

### Step 2 — Deploy the backend

Railway auto-detects the `Dockerfile` in `backend/`.

1. In your Railway project, click **New Service → GitHub Repo** and select the repo again.
2. Set the **Root Directory** to `backend` in the service settings.
3. Railway will build and deploy using `backend/Dockerfile` automatically.
4. Under **Variables**, add all five backend environment variables:

   | Variable | Value |
   |---|---|
   | `FHIR_BASE_URL` | Your FHIR R4 server URL |
   | `FHIR_AUTH_TOKEN` | Bearer token if required (leave blank for public HAPI sandbox) |
   | `ANTHROPIC_API_KEY` | Your Anthropic API key |
   | `CLERK_JWKS_URL` | `https://<your-clerk-domain>/.well-known/jwks.json` |
   | `CLERK_ISSUER` | `https://<your-clerk-domain>` |

5. Under **Settings → Networking**, click **Generate Domain** to get a public HTTPS URL (e.g. `backend.up.railway.app`). Note this URL — you'll need it for the frontend.

---

### Step 3 — Deploy the frontend

1. In the same Railway project, click **New Service → GitHub Repo** and select the repo again.
2. Set the **Root Directory** to `frontend`.
3. Railway will detect Vite and run `npm run build`, serving the `dist/` output via its static hosting.
4. Under **Variables**, add:

   | Variable | Value |
   |---|---|
   | `VITE_CLERK_PUBLISHABLE_KEY` | Your Clerk `pk_live_...` key |
   | `VITE_API_BASE_URL` | The backend Railway domain from Step 2, e.g. `https://backend.up.railway.app` |

5. Under **Settings → Networking**, generate a domain for the frontend service too.

> **CORS:** Before deploying, add your Railway frontend domain (e.g. `https://frontend.up.railway.app`) to the `allow_origins` list in `backend/main.py`.

---

### Step 4 — Custom domain (optional)

1. In each Railway service, go to **Settings → Networking → Custom Domain**.
2. Add your domain (e.g. `app.yourdomain.com` for frontend, `api.yourdomain.com` for backend).
3. Add the CNAME records shown by Railway to your DNS provider.
4. Update `VITE_API_BASE_URL` in the frontend service to match the new backend domain.
5. Update `allow_origins` in `backend/main.py` to match the new frontend domain.

---

### Redeployments

Railway redeploys automatically on every push to the linked branch. To trigger a manual redeploy, click **Redeploy** in the service dashboard or use the Railway CLI:

```bash
npm install -g @railway/cli
railway login
railway up
```

---

### Environment variables reference

| Variable | Used by | Description |
|---|---|---|
| `FHIR_BASE_URL` | Backend | Base URL of the FHIR R4 server |
| `FHIR_AUTH_TOKEN` | Backend | Bearer token for authenticated FHIR servers (optional) |
| `ANTHROPIC_API_KEY` | Backend | Anthropic API key for AI summaries |
| `CLERK_JWKS_URL` | Backend | Clerk JWKS endpoint for JWT verification |
| `CLERK_ISSUER` | Backend | Expected `iss` claim in Clerk JWTs |
| `VITE_CLERK_PUBLISHABLE_KEY` | Frontend | Clerk publishable key (safe to expose) |
| `VITE_API_BASE_URL` | Frontend | Backend base URL in production (omit in local dev) |

---

## Project Structure

```
Patient-Management-App/
├── backend/
│   ├── app/
│   │   ├── auth.py              # JWT verification, PyJWKClient cache, 60s clock-skew leeway
│   │   ├── config.py            # Pydantic-settings config
│   │   ├── fhir_client.py       # FHIR R4 REST client
│   │   ├── models/              # Pydantic request/response models
│   │   ├── routers/
│   │   │   ├── patients.py      # CRUD; ownership tag stamped on create
│   │   │   ├── schedule.py      # Today's appointments; scoped by clinician_id
│   │   │   ├── summary.py       # Patient aggregate, AI summary, vitals history, action recommendations
│   │   │   ├── notes.py         # DocumentReference read/write
│   │   │   ├── events.py        # AuditEvent log (admin only)
│   │   │   └── admin.py         # Seed endpoint (admin only)
│   │   └── services/
│   │       ├── patient_service.py    # FHIR Patient CRUD; _tag ownership filter
│   │       ├── schedule_service.py   # Appointments; filters by owned patient IDs
│   │       ├── summary_service.py    # Aggregate + vitals (dedup & full-history)
│   │       ├── notes_service.py      # DocumentReference read/write
│   │       ├── ai_summary_service.py # Claude pre-visit summary
│   │       ├── action_rec_service.py # Claude action recommendations
│   │       └── audit_service.py      # Fire-and-forget AuditEvent writes
│   ├── tests/
│   ├── main.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/          # NavBar, ProtectedRoute, AdminRoute, PatientFormModal, NoteBody
│   │   ├── hooks/               # useUserRole, useSpeechRecognition
│   │   ├── lib/                 # API client (apiFetchWithAuth), Zod schemas
│   │   └── pages/
│   │       ├── SchedulePage.tsx
│   │       ├── PatientsPage.tsx
│   │       ├── PatientDashboardPage.tsx  # Latest Vitals panel + Clinical Detail icon grid
│   │       ├── VitalsPage.tsx            # Vitals History trend chart + Δ Change table
│   │       ├── LabsPage.tsx
│   │       └── EventsPage.tsx            # Audit log (clinician_admin only)
│   ├── package.json
│   └── Dockerfile
├── docs/
│   ├── adr/                     # Architecture Decision Records (0001–0007)
│   └── tech_stack.md            # Full technology stack reference
├── specs/
│   └── PRD.md                   # Product Requirements (Phases 1–8)
└── docker-compose.yml
```

---

## Architecture Decision Records

Major design decisions are documented in [`docs/adr/`](docs/adr/):

- [ADR 0001](docs/adr/0001-initial-architecture.md) — Initial architecture (React + FastAPI + FHIR R4)
- [ADR 0002](docs/adr/0002-patient-registration-and-management.md) — Patient registration and management
- [ADR 0003](docs/adr/0003-authentication-and-authorisation.md) — Authentication and authorisation (Clerk + PyJWT)
- [ADR 0004](docs/adr/0004-visit-notes-and-clinical-note-history.md) — Visit notes stored as FHIR `DocumentReference`
- [ADR 0005](docs/adr/0005-ai-action-recommendations.md) — AI action recommendations (Claude)
- [ADR 0006](docs/adr/0006-cloud-deployment-architecture.md) — Cloud deployment on Railway
- [ADR 0007](docs/adr/0007-clinician-patient-ownership-via-fhir-metatag.md) — Clinician-scoped patient visibility via FHIR `meta.tag`

---

## Further Reading

- [Technology Stack](docs/tech_stack.md) — detailed breakdown of every library and service used
- [Product Requirements](specs/PRD.md) — full user story catalogue and implementation decisions (Phases 1–8)
