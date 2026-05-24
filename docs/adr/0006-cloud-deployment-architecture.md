# ADR 0006: Cloud Deployment Architecture

**Date:** 2026-05-23
**Status:** Accepted
**Deciders:** Product owner (via design interview, 2026-05-23)

---

## Context

The app runs locally via `docker-compose` (backend on 8000, frontend nginx on 80). Deploying to a cloud PaaS requires resolving four problems that do not exist in the local setup:

1. **Service discovery** — nginx's `proxy_pass http://backend:8000/` resolves inside Docker Compose's network only.
2. **Build-time frontend variables** — Vite bakes `VITE_*` env vars into the JS bundle at `npm run build`. They cannot be injected at container runtime.
3. **Dynamic port assignment** — PaaS platforms (Railway, Cloud Run, App Runner, Azure Container Apps) inject a `PORT` env var and route external traffic to it; hardcoded ports cause failed health checks.
4. **CORS** — the backend hardcoded `http://localhost:5173`; the production frontend URL is not known at build time.

All decisions were made during a structured design interview on 2026-05-23.

---

## Decisions

### 1. Service topology: two independent services

**Decision:** The backend (FastAPI) and frontend (nginx + React SPA) are deployed as two separate services, each built from its own Dockerfile. The initial target platform is Railway.

**Rationale:** Two services give independent deploy pipelines, per-service logs, per-service environment variables, and per-service health checks. Docker Compose–based deployment (a single combined service) was rejected because Railway's Compose support is beta, limits observability, and makes per-service secret injection awkward.

**Alternatives rejected:**
- *Docker Compose on Railway* — beta support, monolithic logs, harder to configure build-time vars per service.
- *Nixpacks auto-detection* — unpredictable; existing Dockerfiles are correct and should be used.

---

### 2. Frontend → backend communication: build-time `VITE_API_BASE_URL`

**Decision:** The React app is told the backend URL via the `VITE_API_BASE_URL` Docker build argument, which Vite bakes into the JS bundle. The frontend Dockerfile exposes `ARG VITE_API_BASE_URL` and `ARG VITE_CLERK_PUBLISHABLE_KEY`. The nginx `/api/` reverse-proxy block is removed; the frontend calls the backend directly.

**Rationale:** This is the standard Vite + container deployment pattern. The backend URL is a public API endpoint protected by JWT auth — having it in the JS bundle is not a security concern. Runtime nginx proxying (Option B) requires `envsubst` on the full nginx config with careful variable escaping and couples the frontend container to the backend's internal hostname. Railway internal networking (Option C) requires a Pro plan.

**Alternatives rejected:**
- *Runtime nginx proxy (`envsubst` on full config)* — fragile variable escaping, extra entrypoint complexity, couples frontend to backend hostname.
- *Railway private networking* — requires Pro plan; adds deployment dependency between services.

---

### 3. Dynamic PORT injection

**Decision:** Both containers read the `PORT` environment variable at startup, with a safe fallback for local use.

- Backend: `CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]`
- Frontend: shell sets `PORT=${PORT:-80}` before running `envsubst '$PORT'` against `nginx.conf.template`, then starts nginx.

**Rationale:** Railway, GCP Cloud Run, AWS App Runner, and Azure Container Apps all inject `PORT`. The `:-fallback` pattern means `docker-compose` continues to work locally without any environment variable changes. Hardcoding port 8000 or 80 causes health check failures on every PaaS that assigns a different port.

---

### 4. CORS: `ALLOWED_ORIGINS` environment variable

**Decision:** The backend reads `ALLOWED_ORIGINS` (a comma-separated string) from the environment and passes it to FastAPI's `CORSMiddleware`. The default value is `http://localhost:5173` so local development requires no configuration change.

**Rationale:** The production frontend URL is not known until the Railway service is created, so it cannot be hardcoded. An env var requires zero code changes when the URL changes (e.g., custom domain, staging environment). A wildcard (`*`) was rejected because it disables origin enforcement on a JWT-authenticated clinical app.

**Alternatives rejected:**
- *Hardcoded production URL* — breaks on every URL change; requires a redeploy to update.
- *Wildcard (`*`)* — removes defence-in-depth on a HIPAA-adjacent application.

---

## Portability note

**`railway.toml` is the only Railway-specific artifact.** Every other change (dynamic PORT, build args, ALLOWED_ORIGINS env var) is standard PaaS practice supported identically by GCP Cloud Run, AWS App Runner, and Azure Container Apps. Migrating to another platform requires:

1. Replacing `railway.toml` with the target platform's service config file.
2. Supplying the same environment variables (and build args for the frontend) through that platform's secret/env management.
3. Setting up a build trigger (Cloud Build, GitHub Actions, Azure DevOps).

No application code, Dockerfile, or nginx config changes are needed.
