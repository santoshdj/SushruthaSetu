# deploy-railway.ps1
# Deploys SushruthaSetu (FastAPI backend + Vite frontend) to Railway.
#
# BEFORE RUNNING:
#   Set your Railway token in the terminal (do NOT paste it in chat):
#     $env:RAILWAY_TOKEN = "your-token-from-railway-dashboard"
#
# USAGE:
#   Phase 1 (create project, services, variables):
#     .\deploy-railway.ps1
#
#   Phase 2 (wire URLs after both services have deployed):
#     .\deploy-railway.ps1 -Phase2 -BackendUrl "https://..." -FrontendUrl "https://..."

param(
    [switch]$Phase2,
    [string]$BackendUrl = "",
    [string]$FrontendUrl = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Helpers ──────────────────────────────────────────────────────────────────

function Parse-EnvFile($path) {
    $vars = @{}
    Get-Content $path | Where-Object { $_ -match '^\s*[^#]\S+=\S' } | ForEach-Object {
        $kv = $_ -split '=', 2
        $vars[$kv[0].Trim()] = $kv[1].Trim()
    }
    return $vars
}

function Set-RailwayVar($key, $value, $service) {
    Write-Host "  Setting $key on '$service'..."
    $value | railway variable set $key --stdin --service $service --skip-deploys --json | Out-Null
}

# ── Preflight checks ──────────────────────────────────────────────────────────

if (-not $env:RAILWAY_TOKEN) {
    Write-Error @"
RAILWAY_TOKEN is not set.
In this terminal, run:
  `$env:RAILWAY_TOKEN = "your-token-here"
Then re-run this script.
"@
    exit 1
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendEnvFile = Join-Path $scriptRoot "backend\.env"
$frontendEnvFile = Join-Path $scriptRoot "frontend\.env.local"

if (-not (Test-Path $backendEnvFile)) {
    Write-Error "backend\.env not found at $backendEnvFile"
    exit 1
}
if (-not (Test-Path $frontendEnvFile)) {
    Write-Error "frontend\.env.local not found at $frontendEnvFile"
    exit 1
}

$env = Parse-EnvFile $backendEnvFile
$frontendEnv = Parse-EnvFile $frontendEnvFile

# ── Phase 2 — wire URLs after first deploy ────────────────────────────────────

if ($Phase2) {
    if (-not $BackendUrl -or -not $FrontendUrl) {
        Write-Error "Phase 2 requires -BackendUrl and -FrontendUrl. Example:`n  .\deploy-railway.ps1 -Phase2 -BackendUrl 'https://...' -FrontendUrl 'https://...'"
        exit 1
    }

    Write-Host ""
    Write-Host "=== Phase 2: Wiring URLs ===" -ForegroundColor Cyan

    # Set VITE_API_BASE_URL on frontend (build variable — triggers rebuild)
    Write-Host "`nSetting VITE_API_BASE_URL on frontend..."
    $BackendUrl.TrimEnd('/') | railway variable set VITE_API_BASE_URL --stdin --service frontend --json | Out-Null
    Write-Host "  Done."

    # Set ALLOWED_ORIGINS on backend (triggers redeploy)
    $origins = "$FrontendUrl,http://localhost:5173"
    Write-Host "`nSetting ALLOWED_ORIGINS on backend..."
    $origins | railway variable set ALLOWED_ORIGINS --stdin --service backend --json | Out-Null
    Write-Host "  Done."

    Write-Host ""
    Write-Host "=== Phase 2 complete ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next: Configure Clerk at https://dashboard.clerk.com"
    Write-Host "  Allowed redirect URLs  -> $FrontendUrl/*"
    Write-Host "  Allowed origins (CORS) -> $FrontendUrl"
    Write-Host ""
    Write-Host "Verify backend health:"
    Write-Host "  curl $($BackendUrl.TrimEnd('/'))/health"
    exit 0
}

# ── Phase 1 — create project, services, variables ────────────────────────────

Write-Host ""
Write-Host "=== Phase 1: Railway project setup ===" -ForegroundColor Cyan

# Step 1: Create project
Write-Host "`n[1/5] Creating Railway project 'SushruthaSetu'..."
Push-Location $scriptRoot
$initOutput = railway init --name SushruthaSetu --json 2>&1
Pop-Location
$projectId = ($initOutput | ConvertFrom-Json).id
Write-Host "  Project ID: $projectId"

# Step 2: Add backend service linked to GitHub
Write-Host "`n[2/5] Adding backend service (GitHub: santoshdj/SushruthaSetu)..."
$backendOutput = railway add --repo santoshdj/SushruthaSetu --service backend --json 2>&1
Write-Host "  Backend service created."

# Step 3: Set backend environment variables
Write-Host "`n[3/5] Setting backend environment variables..."
Set-RailwayVar "FHIR_BASE_URL"      $env['FHIR_BASE_URL']      "backend"
Set-RailwayVar "FHIR_AUTH_TOKEN"    $env['FHIR_AUTH_TOKEN']    "backend"
Set-RailwayVar "ANTHROPIC_API_KEY"  $env['ANTHROPIC_API_KEY']  "backend"
Set-RailwayVar "CLERK_JWKS_URL"     $env['CLERK_JWKS_URL']     "backend"
Set-RailwayVar "CLERK_ISSUER"       $env['CLERK_ISSUER']       "backend"
Write-Host "  All backend vars set. (ALLOWED_ORIGINS will be set in Phase 2)"

# Step 4: Add frontend service linked to GitHub
Write-Host "`n[4/5] Adding frontend service (GitHub: santoshdj/SushruthaSetu)..."
$frontendOutput = railway add --repo santoshdj/SushruthaSetu --service frontend --json 2>&1
Write-Host "  Frontend service created."

# Step 5: Set frontend build variable (Clerk key only; VITE_API_BASE_URL set in Phase 2)
Write-Host "`n[5/5] Setting frontend build variable (Clerk key)..."
Set-RailwayVar "VITE_CLERK_PUBLISHABLE_KEY" $frontendEnv['VITE_CLERK_PUBLISHABLE_KEY'] "frontend"
Write-Host "  Done."

Write-Host ""
Write-Host "=== Phase 1 complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "ACTION REQUIRED — Do these two steps in the Railway dashboard:" -ForegroundColor Yellow
Write-Host "  https://railway.app/project/$projectId"
Write-Host ""
Write-Host "  Backend service:"
Write-Host "    Settings -> Source -> Root Directory  =>  /backend"
Write-Host "    Then click Deploy"
Write-Host ""
Write-Host "  Frontend service:"
Write-Host "    Settings -> Source -> Root Directory  =>  /frontend"
Write-Host "    Variables tab -> enable 'Build Variables' toggle for VITE_CLERK_PUBLISHABLE_KEY"
Write-Host "    Then click Deploy"
Write-Host ""
Write-Host "Once both services are healthy and you have both URLs, run Phase 2:" -ForegroundColor Cyan
Write-Host "  .\deploy-railway.ps1 -Phase2 ``"
Write-Host "    -BackendUrl  'https://<backend-hash>.up.railway.app' ``"
Write-Host "    -FrontendUrl 'https://<frontend-hash>.up.railway.app'"
