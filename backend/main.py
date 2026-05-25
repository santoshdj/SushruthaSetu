import logging

import jwt as pyjwt
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routers import schedule, patients, summary, notes, audit
from app.services.audit import post_audit_event

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)

app = FastAPI(
    title="Patient Management App",
    description="Clinician-facing unified patient dashboard with FHIR integration.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(schedule.router)
app.include_router(patients.router)
app.include_router(summary.router)
app.include_router(notes.router)
app.include_router(audit.router)


def _extract_user_id(request: Request) -> str:
    """Best-effort extraction of Clerk user ID from JWT without re-verification (audit use only)."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return "unknown"
    token = auth[7:]
    try:
        payload = pyjwt.decode(token, options={"verify_signature": False})
        return payload.get("sub", "unknown")
    except Exception:
        return "unknown"


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    if exc.status_code in (401, 403):
        user_id = _extract_user_id(request)
        post_audit_event("unauthorized-access", user_id=user_id, outcome="4")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.get("/health", tags=["Health"])
async def health() -> dict:
    return {"status": "healthy", "version": "1.0.0"}
