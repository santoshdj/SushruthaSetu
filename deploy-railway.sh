#!/usr/bin/env bash
# deploy-railway.sh
# Deploys SushruthaSetu (FastAPI backend + Vite frontend) to Railway.
#
# BEFORE RUNNING:
#   Export your Railway ACCOUNT token in this terminal (do NOT paste it in chat):
#     export RAILWAY_API_TOKEN="your-account-token-from-railway-dashboard"
#   Get it from: railway.app/account/tokens  (scope = Account, not a project)
#
# USAGE:
#   Phase 1 — create project, services, set variables:
#     bash deploy-railway.sh
#
#   Phase 2 — wire URLs after both services have deployed:
#     bash deploy-railway.sh --phase2 \
#       --backend-url  "https://<hash>.up.railway.app" \
#       --frontend-url "https://<hash>.up.railway.app"

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
CYAN='\033[0;36m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'

# ── Argument parsing ──────────────────────────────────────────────────────────
PHASE2=false
BACKEND_URL=""
FRONTEND_URL=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --phase2)       PHASE2=true ;;
    --backend-url)  BACKEND_URL="$2";  shift ;;
    --frontend-url) FRONTEND_URL="$2"; shift ;;
    *) echo -e "${RED}Unknown argument: $1${NC}"; exit 1 ;;
  esac
  shift
done

# ── Helpers ───────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

parse_env() {
  local file="$1" key="$2"
  grep -E "^${key}=" "$file" | head -1 | cut -d'=' -f2-
}

set_var() {
  local key="$1" value="$2" service="$3"
  echo "  Setting ${key} on '${service}'..."
  printf '%s' "$value" | railway variable set "$key" --stdin --service "$service" --skip-deploys --json > /dev/null
}

# ── Preflight ─────────────────────────────────────────────────────────────────
if [[ -z "${RAILWAY_API_TOKEN:-}" ]]; then
  echo -e "${RED}Error: RAILWAY_API_TOKEN is not set.${NC}"
  echo "In this terminal, run:"
  echo "  export RAILWAY_API_TOKEN=\"your-account-token-here\""
  echo "(Account-scoped token from railway.app/account/tokens)"
  echo "Then re-run this script."
  exit 1
fi

BACKEND_ENV="${SCRIPT_DIR}/backend/.env"
FRONTEND_ENV="${SCRIPT_DIR}/frontend/.env.local"

[[ -f "$BACKEND_ENV"  ]] || { echo -e "${RED}Error: backend/.env not found${NC}";        exit 1; }
[[ -f "$FRONTEND_ENV" ]] || { echo -e "${RED}Error: frontend/.env.local not found${NC}"; exit 1; }

# Verify token against the Railway GraphQL API before doing anything
echo "Verifying RAILWAY_API_TOKEN..."
GQL_RESPONSE=$(curl --silent --request POST \
  --url https://backboard.railway.com/graphql/v2 \
  --header "Authorization: Bearer ${RAILWAY_API_TOKEN}" \
  --header "Content-Type: application/json" \
  --data '{"query":"query { me { name email } }"}')
GQL_NAME=$(printf '%s' "$GQL_RESPONSE" | py -c "import sys,json; d=json.load(sys.stdin); print(d['data']['me']['name'])" 2>/dev/null || true)
if [[ -z "$GQL_NAME" ]]; then
  echo -e "${RED}Token verification failed. Raw response:${NC}"
  printf '%s\n' "$GQL_RESPONSE"
  echo ""
  echo "Ensure RAILWAY_API_TOKEN is an Account-scoped token from railway.app/account/tokens"
  exit 1
fi
echo -e "  ${GREEN}Token valid — logged in as: ${GQL_NAME}${NC}"

# ── Phase 2 — wire URLs ───────────────────────────────────────────────────────
if $PHASE2; then
  if [[ -z "$BACKEND_URL" || -z "$FRONTEND_URL" ]]; then
    echo -e "${RED}Error: --phase2 requires --backend-url and --frontend-url.${NC}"
    echo "Example:"
    echo "  bash deploy-railway.sh --phase2 \\"
    echo "    --backend-url  'https://...' \\"
    echo "    --frontend-url 'https://...'"
    exit 1
  fi

  echo -e "\n${CYAN}=== Phase 2: Wiring URLs ===${NC}\n"

  cd "$SCRIPT_DIR"

  echo "Setting VITE_API_BASE_URL on frontend..."
  printf '%s' "${BACKEND_URL%/}" \
    | railway variable set VITE_API_BASE_URL --stdin --service frontend --json > /dev/null
  echo "  Done."

  echo "Setting ALLOWED_ORIGINS on backend..."
  printf '%s' "${FRONTEND_URL},http://localhost:5173" \
    | railway variable set ALLOWED_ORIGINS --stdin --service backend --json > /dev/null
  echo "  Done."

  echo -e "\n${GREEN}=== Phase 2 complete ===${NC}\n"
  echo "Next: Configure Clerk at https://dashboard.clerk.com"
  echo "  Allowed redirect URLs  ->  ${FRONTEND_URL}/*"
  echo "  Allowed origins (CORS) ->  ${FRONTEND_URL}"
  echo ""
  echo "Verify backend health:"
  echo "  curl ${BACKEND_URL%/}/health"
  exit 0
fi

# ── Phase 1 — create project, services, variables ────────────────────────────
echo -e "\n${CYAN}=== Phase 1: Railway project setup ===${NC}"

# Read secrets from .env files (never hardcoded, never echoed to stdout)
FHIR_BASE_URL=$(parse_env "$BACKEND_ENV" "FHIR_BASE_URL")
FHIR_AUTH_TOKEN=$(parse_env "$BACKEND_ENV" "FHIR_AUTH_TOKEN")
ANTHROPIC_API_KEY=$(parse_env "$BACKEND_ENV" "ANTHROPIC_API_KEY")
CLERK_JWKS_URL=$(parse_env "$BACKEND_ENV" "CLERK_JWKS_URL")
CLERK_ISSUER=$(parse_env "$BACKEND_ENV" "CLERK_ISSUER")
VITE_CLERK_KEY=$(parse_env "$FRONTEND_ENV" "VITE_CLERK_PUBLISHABLE_KEY")

cd "$SCRIPT_DIR"

# [1] Create project
echo -e "\n[1/5] Creating Railway project 'SushruthaSetu'..."
INIT_OUT=$(railway init --name SushruthaSetu --json)   # stderr stays on terminal
if [[ -z "$INIT_OUT" ]]; then
  echo -e "${RED}Error: 'railway init' returned no output. Check the error above (likely auth or network).${NC}"
  exit 1
fi
PROJECT_ID=$(printf '%s' "$INIT_OUT" \
  | py -c "import sys,json; data=sys.stdin.read(); lines=[l for l in data.splitlines() if l.strip().startswith('{')]; print(json.loads(lines[-1])['id'])")
echo "  Project ID: ${PROJECT_ID}"

# [2] Add backend service linked to GitHub
echo -e "\n[2/5] Adding backend service (GitHub: santoshdj/SushruthaSetu)..."
railway add --repo santoshdj/SushruthaSetu --service backend --json \
  | py -c "import sys,json; d=json.load(sys.stdin); print('  Service ID:', d.get('id','(created)'))" \
  || echo "  Backend service created."

# [3] Set backend variables
echo -e "\n[3/5] Setting backend environment variables..."
set_var "FHIR_BASE_URL"     "$FHIR_BASE_URL"     "backend"
set_var "FHIR_AUTH_TOKEN"   "$FHIR_AUTH_TOKEN"   "backend"
set_var "ANTHROPIC_API_KEY" "$ANTHROPIC_API_KEY" "backend"
set_var "CLERK_JWKS_URL"    "$CLERK_JWKS_URL"    "backend"
set_var "CLERK_ISSUER"      "$CLERK_ISSUER"      "backend"
echo "  All backend vars set. (ALLOWED_ORIGINS will be set in Phase 2)"

# [4] Add frontend service linked to GitHub
echo -e "\n[4/5] Adding frontend service (GitHub: santoshdj/SushruthaSetu)..."
railway add --repo santoshdj/SushruthaSetu --service frontend --json \
  | py -c "import sys,json; d=json.load(sys.stdin); print('  Service ID:', d.get('id','(created)'))" \
  || echo "  Frontend service created."

# [5] Set frontend Clerk key
echo -e "\n[5/5] Setting frontend Clerk publishable key..."
set_var "VITE_CLERK_PUBLISHABLE_KEY" "$VITE_CLERK_KEY" "frontend"
echo "  Done. (VITE_API_BASE_URL will be set in Phase 2)"

echo -e "\n${GREEN}=== Phase 1 complete ===${NC}\n"
echo -e "${YELLOW}ACTION REQUIRED — Do these steps in the Railway dashboard:${NC}"
echo "  https://railway.app/project/${PROJECT_ID}"
echo ""
echo "  Backend service:"
echo "    Settings -> Source -> Root Directory  =>  /backend"
echo "    Then click Deploy"
echo ""
echo "  Frontend service:"
echo "    Settings -> Source -> Root Directory  =>  /frontend"
echo "    Variables tab -> enable 'Build Variables' toggle for VITE_CLERK_PUBLISHABLE_KEY"
echo "    Then click Deploy"
echo ""
echo -e "${CYAN}Once both services are healthy and you have both URLs, run Phase 2:${NC}"
echo "  bash deploy-railway.sh --phase2 \\"
echo "    --backend-url  'https://<backend-hash>.up.railway.app' \\"
echo "    --frontend-url 'https://<frontend-hash>.up.railway.app'"
