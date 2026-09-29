"""
HeatShield AI – Prediction API Router
POST /api/predict/heatwave
POST /api/predict/thermal-stress
GET  /api/predict/forecast
GET  /api/predict/model-metrics
"""
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from app.ml.predict import get_model_metrics, predict_heatwave
from app.schemas.prediction import (
    ForecastItem,
    HeatwavePredictionResponse,
    PredictionRequest,
    ThermalStressRequest,
    ThermalStressResponse,
)
from app.services.risk_engine import classify_risk
from app.services.thermal_stress import thermal_stress_score
from app.services.weather_service import WeatherUnavailableError, get_current_weather, get_forecast

router = APIRouter(prefix="/api/predict", tags=["prediction"])

WEATHER_UNAVAILABLE = "Live weather data is currently unavailable."
PREDICTION_UNAVAILABLE = "Heatwave prediction is currently unavailable."


@router.post("/heatwave", response_model=HeatwavePredictionResponse)
def predict_heatwave_endpoint(req: PredictionRequest):
    """
    Predict heatwave probability using live Open-Meteo data.
    If weather data is provided in the request, it is used directly.
    Otherwise fresh data is fetched from Open-Meteo.
    """
    # Use provided values or fetch from Open-Meteo
    if req.temperature is not None and req.humidity is not None:
        temp = req.temperature
        hum = req.humidity
        wind = req.wind_speed or 0.0
        solar = req.solar_radiation or 500.0
        precip = req.precipitation or 0.0
        pressure = req.pressure or 1013.25
        dew = req.dew_point or (temp - (100 - hum) / 5)
    else:
        try:
            w = get_current_weather(req.latitude, req.longitude, city=req.city)
        except WeatherUnavailableError:
            raise HTTPException(status_code=503, detail=WEATHER_UNAVAILABLE)
        temp = w["temperature"]
        hum = w["humidity"]
        wind = w["wind_speed"]
        solar = w["solar_radiation"]
        precip = w["precipitation"]
        pressure = w["pressure"]
        dew = w["dew_point"]

    now = datetime.now(timezone.utc)
    features = {
        "temperature": temp,
        "max_temperature": req.max_temperature or (temp + 3),
        "min_temperature": req.min_temperature or (temp - 4),
        "humidity": hum,
        "wind_speed": wind,
        "pressure": pressure,
        "solar_radiation": solar,
        "precipitation": precip,
        "dew_point": dew,
        "latitude": req.latitude,
        "longitude": req.longitude,
        "day_of_year": now.timetuple().tm_yday,
        "month": now.month,
    }

    try:
        result = predict_heatwave(features)
    except Exception as e:
        raise HTTPException(status_code=503, detail=PREDICTION_UNAVAILABLE)

    ts = thermal_stress_score(temp, hum, wind, solar)

    return HeatwavePredictionResponse(
        heatwave_probability=result["heatwave_probability"],
        classification=result["classification"],
        risk_level=result["risk_level"],
        heat_index=result["heat_index"],
        thermal_stress_score=ts["stress_score"],
        thermal_stress_category=ts["category"],
        explanation=result["explanation"],
        model_source=result["model_source"],
        note=result["note"],
    )


@router.post("/thermal-stress", response_model=ThermalStressResponse)
def thermal_stress_endpoint(req: ThermalStressRequest):
    result = thermal_stress_score(req.temperature, req.humidity, req.wind_speed, req.solar_radiation)
    return ThermalStressResponse(
        temperature=req.temperature,
        humidity=req.humidity,
        heat_index=result["heat_index"],
        stress_score=result["stress_score"],
        category=result["category"],
        explanation=result["explanation"],
    )


@router.get("/forecast")
def forecast_with_predictions(
    city: str = Query("Hyderabad"),
    lat: float = Query(17.385),
    lon: float = Query(78.486),
):
    """
    Fetch live hourly forecast from Open-Meteo and enrich each horizon
    with heatwave probability, thermal stress, and risk level.
    """
    try:
        raw_forecast = get_forecast(lat, lon, city=city)
    except WeatherUnavailableError:
        raise HTTPException(status_code=503, detail=WEATHER_UNAVAILABLE)

    now = datetime.now(timezone.utc)
    enriched = []
    for item in raw_forecast:
        temp = item.get("temperature")
        hum = item.get("humidity")

        if temp is None or hum is None:
            continue

        wind = item.get("wind_speed", 0.0) or 0.0
        pressure = item.get("pressure", 1013.25) or 1013.25
        solar = item.get("solar_radiation", 0.0) or 0.0
        dew = item.get("dew_point")

        features = {
            "temperature": temp,
            "max_temperature": temp + 2.5,
            "min_temperature": temp - 3,
            "humidity": hum,
            "wind_speed": wind,
            "pressure": pressure,
            "solar_radiation": solar,
            "precipitation": item.get("precipitation", 0.0) or 0.0,
            "dew_point": dew if dew is not None else (temp - (100 - hum) / 5),
            "latitude": lat,
            "longitude": lon,
            "day_of_year": now.timetuple().tm_yday,
            "month": now.month,
        }
        pred = predict_heatwave(features)
        ts = thermal_stress_score(temp, hum, wind, solar)
        risk = classify_risk(pred["heatwave_probability"], ts["stress_score"], temp)

        enriched.append(ForecastItem(
            horizon_hours=item["horizon_hours"],
            timestamp=item["timestamp"],
            temperature=temp,
            humidity=hum,
            wind_speed=wind,
            pressure=pressure,
            heatwave_probability=pred["heatwave_probability"],
            thermal_stress_score=ts["stress_score"],
            risk_level=risk,
            source="Open-Meteo",
        ))

    return {"status": "ok", "data_source": "Open-Meteo", "data": enriched}


@router.get("/model-metrics")
def model_metrics():
    metrics = get_model_metrics()
    if metrics is None:
        return {
            "status": "no_model",
            "message": "Model not trained yet. Run: python backend/app/ml/train_model.py",
        }
    return {"status": "ok", "metrics": metrics}
