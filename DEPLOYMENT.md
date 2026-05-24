# Deployment Guide

This guide covers deploying the Patient Management App to Railway. The same
Dockerfiles and environment variables work on GCP Cloud Run, AWS App Runner, and
Azure Container Apps — see [Deploying to other clouds](#deploying-to-other-clouds)
for what changes.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| GitHub account | App source must be in a GitHub repo |
| Railway account | [railway.app](https://railway.app) — Hobby plan ($5/mo) is sufficient |
| Clerk app configured | [dashboard.clerk.com](https://dashboard.clerk.com) |
| FHIR server URL + token | Already in `backend/.env` |
| Anthropic API key | Already in `backend/.env` |

---

## Step 1 — Prepare the repository

```bash
cd Patient-Management-App
git init
git add .
git commit -m "Initial commit"
# Push to GitHub
gh repo create patient-management-app --private --source=. --push
```

> `.gitignore` covers `backend/.env` and `frontend/.env.local` — secrets will
> NOT be committed.

---

## Step 2 — Create a Railway project

1. Go to [railway.app/new](https://railway.app/new) → **Deploy from GitHub repo**
2. Select your `patient-management-app` repo
3. Railway will detect the repo — **do not let it auto-deploy yet**; click **Add service** instead and follow Steps 3 and 4.

---

## Step 3 — Backend service

### 3a. Create the service
1. In your Railway project → **+ New Service** → **GitHub Repo**
2. Select the same repo
3. Under **Settings → Source**: set **Root Directory** to `/backend`
4. Railway detects `railway.toml` automatically — build and health check are pre-configured

### 3b. Set environment variables
Go to the backend service → **Variables** tab and add:

| Variable | Value |
|---|---|
| `FHIR_BASE_URL` | `https://fhir.medblocks.com/fhir/<tenant>` |
| `FHIR_AUTH_TOKEN` | `eyJ...` (from `backend/.env`) |
| `ANTHROPIC_API_KEY` | `sk-ant-...` (from `backend/.env`) |
| `CLERK_JWKS_URL` | `https://<clerk-domain>/.well-known/jwks.json` |
| `CLERK_ISSUER` | `https://<clerk-domain>` |
| `ALLOWED_ORIGINS` | *(leave blank for now — fill in after Step 4 gives you the frontend URL)* |

### 3c. Deploy and note the URL
Click **Deploy**. Once healthy, copy the Railway-assigned URL:
```
https://patient-mgmt-backend-<hash>.up.railway.app
```

---

## Step 4 — Frontend service

### 4a. Create the service
1. In your Railway project → **+ New Service** → **GitHub Repo**
2. Select the same repo
3. Under **Settings → Source**: set **Root Directory** to `/frontend`

### 4b. Set build variables
Frontend variables **must be set as Build Variables** (not runtime env vars)
because Vite bakes them into the JS bundle at `npm run build`.

Go to the frontend service → **Variables** tab → toggle **Build Variables** and add:

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | The backend URL from Step 3c (e.g. `https://patient-mgmt-backend-<hash>.up.railway.app`) |
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_live_...` from Clerk dashboard |

### 4c. Deploy and note the URL
Click **Deploy**. Copy the frontend URL:
```
https://patient-mgmt-frontend-<hash>.up.railway.app
```

---

## Step 5 — Wire the CORS origin

Go back to the **backend service → Variables** and set:

```
ALLOWED_ORIGINS=https://patient-mgmt-frontend-<hash>.up.railway.app,http://localhost:5173
```

Railway will redeploy the backend automatically.

---

## Step 6 — Configure Clerk for the production URL

In the [Clerk dashboard](https://dashboard.clerk.com):

1. **Allowed redirect URLs** → add `https://patient-mgmt-frontend-<hash>.up.railway.app/*`
2. **Allowed origins** (under CORS settings) → add `https://patient-mgmt-frontend-<hash>.up.railway.app`

Without this, Clerk will refuse to issue tokens from the production domain.

---

## Step 7 — Verify

```bash
# Backend health check
curl https://patient-mgmt-backend-<hash>.up.railway.app/health
# → {"status":"healthy","version":"1.0.0"}

# Patient count (requires valid Clerk JWT from the browser)
# Open the frontend URL and check the Patients page loads
```

---

## Custom domain (optional)

In Railway: service → **Settings → Networking → Custom Domain** → add your domain
and update DNS. Then update `ALLOWED_ORIGINS` on the backend and Clerk's allowed
origins/redirect URLs to use the custom domain.

---

## Deploying to other clouds

**Only `railway.toml` is Railway-specific.** The Dockerfiles, env vars, and nginx
config are unchanged on every other platform.

### GCP Cloud Run

```bash
# Build and push images
gcloud builds submit ./backend --tag gcr.io/$PROJECT/pma-backend
gcloud builds submit ./frontend \
  --tag gcr.io/$PROJECT/pma-frontend \
  --build-arg VITE_API_BASE_URL=https://pma-backend-<hash>.run.app \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_live_...

# Deploy backend
gcloud run deploy pma-backend \
  --image gcr.io/$PROJECT/pma-backend \
  --set-env-vars FHIR_BASE_URL=...,FHIR_AUTH_TOKEN=...,ALLOWED_ORIGINS=https://pma-frontend-<hash>.run.app

# Deploy frontend
gcloud run deploy pma-frontend \
  --image gcr.io/$PROJECT/pma-frontend \
  --allow-unauthenticated
```

Cloud Run injects `PORT` automatically — no app changes needed.

---

### AWS App Runner

```yaml
# apprunner.yaml (place in backend/ or frontend/)
version: 1.0
runtime: DOCKER
build:
  context: .
  dockerfile: Dockerfile
run:
  env:
    - name: FHIR_BASE_URL
      value: "{{resolve:ssm:/pma/fhir_base_url}}"
    # ... other vars from SSM Parameter Store
  port: 8000   # App Runner maps external traffic; PORT is injected automatically
```

App Runner also injects `PORT`. Build args for the frontend require a separate
`docker build` step in a CodeBuild pipeline with `--build-arg`.

---

### Azure Container Apps

```bash
# Build with ACR
az acr build --registry $ACR_NAME --image pma-backend ./backend
az acr build --registry $ACR_NAME --image pma-frontend ./frontend \
  --build-arg VITE_API_BASE_URL=https://pma-backend.<env>.azurecontainerapps.io \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_live_...

# Deploy
az containerapp create --name pma-backend \
  --env-vars FHIR_BASE_URL=... FHIR_AUTH_TOKEN=secretref:fhir-token ALLOWED_ORIGINS=...

az containerapp create --name pma-frontend
```

Azure Container Apps injects `PORT` — no app changes needed.

---

## Local development (unchanged)

`docker-compose` continues to work with no changes. The `${PORT:-8000}` and
`${PORT:-80}` fallbacks ensure local containers use their original ports when
`PORT` is not set.

```bash
cd Patient-Management-App
docker-compose up --build
# Backend: http://localhost:8000
# Frontend: http://localhost:80
```
