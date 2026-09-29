"""
HeatShield AI – Vulnerable Population API Router
POST /api/vulnerable/risk
GET  /api/vulnerable/categories
"""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException

from app.ml.predict import predict_heatwave
from app.schemas.prediction import VulnerableRequest
from app.services.risk_engine import classify_risk
from app.services.thermal_stress import thermal_stress_score
from app.services.vulnerable_engine import CATEGORIES, assess_vulnerable_risk
from app.services.weather_service import WeatherUnavailableError, get_current_weather

router = APIRouter(prefix="/api/vulnerable", tags=["vulnerable"])


@router.post("/risk")
def vulnerable_risk(req: VulnerableRequest):
    """
    Assess heat risk for a specific vulnerable population category.
    Fetches live weather from Open-Meteo, runs ML prediction and thermal stress,
    then applies category-specific sensitivity multiplier.
    Changing the category triggers a fresh backend recalculation.
    """
    # Fetch live weather
    try:
        weather = get_current_weather(req.latitude, req.longitude, city=req.city)
    except WeatherUnavailableError:
        raise HTTPException(
            status_code=503,
            detail="Live weather data is currently unavailable.",
        )

    temp = weather["temperature"]
    hum = weather["humidity"]
    wind = weather["wind_speed"]
    solar = weather["solar_radiation"]

    now = datetime.now(timezone.utc)
    features = {
        "temperature": temp,
        "max_temperature": temp + 3,
        "min_temperature": temp - 4,
        "humidity": hum,
        "wind_speed": wind,
        "solar_radiation": solar,
        "pressure": weather["pressure"],
        "precipitation": weather["precipitation"],
        "dew_point": weather["dew_point"],
        "latitude": req.latitude,
        "longitude": req.longitude,
        "day_of_year": now.timetuple().tm_yday,
        "month": now.month,
    }

    try:
        pred = predict_heatwave(features)
    except Exception:
        raise HTTPException(status_code=503, detail="Heatwave prediction is currently unavailable.")

    ts = thermal_stress_score(temp, hum, wind, solar)
    base_risk = classify_risk(pred["heatwave_probability"], ts["stress_score"], temp)

    # Category-specific recalculation — changing category changes the result
    result = assess_vulnerable_risk(
        base_risk=base_risk,
        category=req.category,
        heatwave_probability=pred["heatwave_probability"],
        thermal_stress_score=ts["stress_score"],
        temperature=temp,
    )

    return {
        "status": "ok",
        "city": req.city,
        "data_source": "Open-Meteo",
        "weather": {
            "temperature": temp,
            "humidity": hum,
            "wind_speed": wind,
            "solar_radiation": solar,
            "last_updated": weather["timestamp"],
        },
        "heatwave_probability": pred["heatwave_probability"],
        "thermal_stress_score": ts["stress_score"],
        "thermal_stress_category": ts["category"],
        "base_risk": base_risk,
        "vulnerable_assessment": result,
    }


@router.get("/categories")
def categories():
    return {"categories": CATEGORIES}
