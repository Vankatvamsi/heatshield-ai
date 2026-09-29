"""
HeatShield AI – Risk Map API Router
GET /api/risk/map
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.models import Location
from app.database.session import get_db
from app.ml.predict import predict_heatwave
from app.services.risk_engine import classify_risk
from app.services.thermal_stress import thermal_stress_score
from app.services.weather_service import WeatherUnavailableError, get_current_weather

router = APIRouter(prefix="/api/risk", tags=["risk"])


@router.get("/map")
def risk_map(db: Session = Depends(get_db)):
    """
    Returns risk assessment for all saved locations using live Open-Meteo data.
    If a location's weather is unavailable, it is returned with an error flag
    instead of fake data.
    """
    locations = db.query(Location).filter(Location.is_active == True).all()
    results = []
    now = datetime.now(timezone.utc)

    for loc in locations:
        try:
            w = get_current_weather(loc.latitude, loc.longitude, city=loc.city or loc.name)
            temp = w["temperature"]
            hum = w["humidity"]
            wind = w["wind_speed"]
            solar = w["solar_radiation"]

            features = {
                "temperature": temp,
                "max_temperature": temp + 3,
                "min_temperature": temp - 4,
                "humidity": hum,
                "wind_speed": wind,
                "solar_radiation": solar,
                "pressure": w["pressure"],
                "precipitation": w["precipitation"],
                "dew_point": w["dew_point"],
                "latitude": loc.latitude,
                "longitude": loc.longitude,
                "day_of_year": now.timetuple().tm_yday,
                "month": now.month,
            }
            pred = predict_heatwave(features)
            ts = thermal_stress_score(temp, hum, wind, solar)
            risk = classify_risk(pred["heatwave_probability"], ts["stress_score"], temp)

            results.append({
                "id": loc.id,
                "name": loc.name,
                "city": loc.city,
                "state": loc.state,
                "latitude": loc.latitude,
                "longitude": loc.longitude,
                "temperature": temp,
                "humidity": hum,
                "wind_speed": wind,
                "pressure": w["pressure"],
                "precipitation": w["precipitation"],
                "dew_point": w["dew_point"],
                "heatwave_probability": pred["heatwave_probability"],
                "thermal_stress_score": ts["stress_score"],
                "thermal_stress_category": ts["category"],
                "risk_level": risk,
                "data_source": "Open-Meteo",
                "last_updated": w["timestamp"],
                "error": None,
            })

        except WeatherUnavailableError as e:
            results.append({
                "id": loc.id,
                "name": loc.name,
                "city": loc.city,
                "latitude": loc.latitude,
                "longitude": loc.longitude,
                "error": "Live weather data is currently unavailable.",
                "data_source": "Open-Meteo",
            })
        except Exception as e:
            results.append({
                "id": loc.id,
                "name": loc.name,
                "city": loc.city,
                "latitude": loc.latitude,
                "longitude": loc.longitude,
                "error": "Data unavailable.",
                "data_source": "Open-Meteo",
            })

    return {"status": "ok", "data_source": "Open-Meteo", "count": len(results), "data": results}
