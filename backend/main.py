import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import schedule, patients, summary, notes

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
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(schedule.router)
app.include_router(patients.router)
app.include_router(summary.router)
app.include_router(notes.router)


@app.get("/health", tags=["Health"])
async def health() -> dict:
    return {"status": "healthy", "version": "1.0.0"}
