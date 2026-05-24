# Patient Management App

A practitioner-facing clinical dashboard that gives doctors and clinicians a single place to view patient information, manage patient records, and receive AI-generated pre-visit summaries — without chasing data across multiple systems.

## Features

- **Daily schedule** — today's appointments with one-click patient drill-down
- **Patient registry** — search, create, and edit patients backed by a FHIR R4 server
- **Clinical dashboard** — problems, medications, allergies, vitals, labs, visit history, and care gap alerts per patient
- **AI pre-visit summary** — Claude-generated narrative from all 7 clinical sections
- **Role-based access** — clinicians get read-only access; admins can create and edit patients

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
3. Click **Metadata → Public** and add:

```json
{ "role": "admin" }
```

Users without a `role` key default to `clinician` (read-only).

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
│   │   ├── auth.py              # JWT verification + role enforcement
│   │   ├── config.py            # Pydantic-settings config
│   │   ├── fhir_client.py       # FHIR R4 REST client
│   │   ├── models/              # Pydantic request/response models
│   │   ├── routers/             # FastAPI route handlers
│   │   └── services/            # Business logic (schedule, patients, AI summary)
│   ├── tests/
│   ├── main.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/          # NavBar, ProtectedRoute, PatientFormModal
│   │   ├── hooks/               # useRole
│   │   ├── lib/                 # API client, Zod schemas
│   │   └── pages/               # SchedulePage, PatientsPage, PatientDashboardPage
│   ├── package.json
│   └── Dockerfile
├── docs/
│   └── adr/                     # Architecture Decision Records
├── specs/
│   └── PRD.md
└── docker-compose.yml
```

---

## Architecture Decision Records

Major design decisions are documented in [`docs/adr/`](docs/adr/):

- [ADR 0001](docs/adr/0001-initial-architecture.md) — Initial architecture (React + FastAPI + FHIR R4)
- [ADR 0002](docs/adr/0002-patient-registration-and-management.md) — Patient registration and management
- [ADR 0003](docs/adr/0003-authentication-and-authorisation.md) — Authentication and authorisation (Clerk + PyJWT)
