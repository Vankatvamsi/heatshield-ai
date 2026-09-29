"""
HeatShield AI – FastAPI Application Entry Point
================================================
Startup:
    uvicorn app.main:app --reload  (from the backend/ directory)
    OR
    uvicorn backend.app.main:app --reload  (from the project root)

API Docs:  http://127.0.0.1:8000/docs
Health:    http://127.0.0.1:8000/api/health

Data Source: Open-Meteo (https://open-meteo.com) – no API key required.
Database:    PostgreSQL via SQLAlchemy + psycopg2
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    admin_api, alerts, auth, history, live_protection_api, locations as locations_router,
    personal_profile_api, prediction, risk, routes_api, settings_api, uhi, vulnerable, weather, sos_api
)
from app.api.auth import profile_router
from app.database.init_db import init_db
from app.services.scheduler import start_scheduler, stop_scheduler
from app.utils.config import get_settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("heatshield")

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup and shutdown tasks."""
    logger.info("🚀 Starting HeatShield AI Backend…")
    logger.info("   Data Source: Open-Meteo (no API key required)")
    logger.info("   Database: PostgreSQL")
    init_db()
    start_scheduler()
    yield
    stop_scheduler()
    logger.info("👋 HeatShield AI Backend shutting down.")


app = FastAPI(
    title="HeatShield AI",
    description=(
        "AI-Powered Extreme Heatwave Early Warning & Human Thermal Stress Monitoring API.\n\n"
        "**Data Source**: Open-Meteo (https://open-meteo.com) – free, no API key required.\n\n"
        "**Database**: PostgreSQL\n\n"
        "**DISCLAIMER**: This is a prototype / decision-support tool and is NOT a medical "
        "diagnostic system. It should not replace official meteorological or public-health advisories."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(admin_api.router)
app.include_router(personal_profile_api.router)
app.include_router(live_protection_api.router)
app.include_router(routes_api.router)
app.include_router(weather.router)
app.include_router(locations_router.router)
app.include_router(prediction.router)
app.include_router(risk.router)
app.include_router(alerts.router)
app.include_router(uhi.router)
app.include_router(vulnerable.router)
app.include_router(history.router)
app.include_router(settings_api.router)
app.include_router(sos_api.router)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["system"])
def health():
    return {
        "status": "ok",
        "service": "HeatShield AI Backend",
        "version": "2.0.0",
        "data_source": "Open-Meteo",
        "database": "PostgreSQL",
    }
