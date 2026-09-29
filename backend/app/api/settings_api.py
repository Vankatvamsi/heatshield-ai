"""
HeatShield AI – Settings API Router
GET /api/settings/thresholds
PUT /api/settings/thresholds
GET /api/settings/mode
"""
import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.utils.config import get_settings

router = APIRouter(prefix="/api/settings", tags=["settings"])
settings = get_settings()
_THRESH_FILE = (Path(__file__).resolve().parents[4] / "config" / "risk_thresholds.json").resolve()


@router.get("/thresholds")
def get_thresholds():
    return {"status": "ok", "thresholds": settings.load_thresholds()}


class ThresholdUpdate(BaseModel):
    thresholds: dict


@router.put("/thresholds")
def update_thresholds(body: ThresholdUpdate):
    try:
        with open(_THRESH_FILE, "w") as f:
            json.dump(body.thresholds, f, indent=2)
        return {"status": "ok", "message": "Thresholds updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/mode")
def app_mode():
    """
    Always returns LIVE DATA.
    The application uses Open-Meteo for all weather data — no demo mode.
    """
    return {
        "mode": "live",
        "is_demo": False,
        "label": "LIVE DATA",
        "data_source": "Open-Meteo",
        "scheduler_interval_minutes": settings.WEATHER_UPDATE_INTERVAL_MINUTES,
    }
