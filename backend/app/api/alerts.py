"""
HeatShield AI – Alerts API Router
GET  /api/alerts
POST /api/alerts/evaluate
PUT  /api/alerts/{alert_id}/acknowledge
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.models import Location
from app.database.session import get_db
from app.ml.predict import predict_heatwave
from app.services.alert_engine import acknowledge_alert, evaluate_and_create_alert, get_alerts
from app.services.risk_engine import classify_risk
from app.services.thermal_stress import thermal_stress_score
from app.services.weather_service import WeatherUnavailableError, get_current_weather

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


def _format_alert(alert, db: Session) -> dict:
    loc = db.query(Location).filter(Location.id == alert.location_id).first()
    return {
        "id": alert.id,
        "location_id": alert.location_id,
        "location_name": loc.name if loc else "Unknown",
        "alert_level": alert.alert_level,
        "message": alert.message,
        "risk_level": alert.risk_level,
        "temperature": alert.temperature,
        "heatwave_probability": alert.heatwave_probability,
        "thermal_stress_score": alert.thermal_stress_score,
        "created_at": alert.created_at.isoformat() if alert.created_at else "",
        "acknowledged": alert.acknowledged,
    }


@router.get("")
def list_alerts(
    location_id: int = Query(None),
    limit: int = Query(50),
    db: Session = Depends(get_db),
):
    alerts = get_alerts(db, location_id=location_id, limit=limit)
    return {
        "status": "ok",
        "count": len(alerts),
        "data": [_format_alert(a, db) for a in alerts],
    }


@router.post("/evaluate")
def evaluate_alert(
    city: str = Query(...),
    lat: float = Query(...),
    lon: float = Query(...),
    db: Session = Depends(get_db),
):
    """
    Evaluate current conditions for a location and create an alert if warranted.
    Uses live Open-Meteo data for all calculations.
    """
    loc = db.query(Location).filter(Location.city == city).first()
    if not loc:
        # Try fuzzy match by name
        loc = db.query(Location).filter(Location.name.ilike(f"%{city}%")).first()
    if not loc:
        raise HTTPException(status_code=404, detail=f"Location '{city}' not found in database.")

    try:
        w = get_current_weather(lat, lon, city=city)
    except WeatherUnavailableError:
        raise HTTPException(status_code=503, detail="Live weather data is currently unavailable.")

    temp = w["temperature"]
    hum = w["humidity"]
    wind = w["wind_speed"]
    solar = w["solar_radiation"]

    now = datetime.now(timezone.utc)
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
        "latitude": lat,
        "longitude": lon,
        "day_of_year": now.timetuple().tm_yday,
        "month": now.month,
    }

    pred = predict_heatwave(features)
    ts = thermal_stress_score(temp, hum, wind, solar)
    risk = classify_risk(pred["heatwave_probability"], ts["stress_score"], temp)

    alert = evaluate_and_create_alert(
        db, loc,
        heatwave_probability=pred["heatwave_probability"],
        thermal_stress_score=ts["stress_score"],
        temperature=temp,
        risk_level=risk,
    )

    if alert:
        return {"status": "ok", "alert_created": True, "alert": _format_alert(alert, db)}
    return {"status": "ok", "alert_created": False, "message": "Conditions below alert threshold"}


@router.put("/{alert_id}/acknowledge")
def ack_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = acknowledge_alert(db, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "ok", "alert_id": alert_id, "acknowledged": True}
