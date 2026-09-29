"""
HeatShield AI – ML Prediction Module
Loads the trained model and preprocessing pipeline to make heatwave predictions.
Falls back to a rule-based estimator if no model file exists (demo mode).
"""
import json
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parents[3]
MODEL_PATH = ROOT / "models" / "heatwave_model.pkl"
PIPELINE_PATH = ROOT / "models" / "preprocess.joblib"
METRICS_PATH = ROOT / "models" / "metrics.json"

FEATURE_COLS = [
    "temperature", "max_temperature", "min_temperature", "humidity",
    "wind_speed", "pressure", "solar_radiation", "precipitation", "dew_point",
    "latitude", "longitude", "day_of_year", "month", "heat_index",
    "temp_humidity_interaction", "temp_anomaly", "rolling_avg_temp",
    "rolling_max_temp", "recent_heatwave_count",
]

_model = None
_pipeline = None
_metrics = None


def _load():
    global _model, _pipeline, _metrics
    if _model is None:
        try:
            import joblib
            _model = joblib.load(MODEL_PATH)
            _pipeline = joblib.load(PIPELINE_PATH)
        except Exception:
            _model = None
            _pipeline = None
    if _metrics is None:
        try:
            with open(METRICS_PATH) as f:
                _metrics = json.load(f)
        except Exception:
            _metrics = None


def _compute_heat_index(temp_c: float, humidity: float) -> float:
    T = temp_c * 9 / 5 + 32
    RH = max(0, min(100, humidity))
    HI = (
        -42.379 + 2.04901523 * T + 10.14333127 * RH
        - 0.22475541 * T * RH - 0.00683783 * T ** 2
        - 0.05481717 * RH ** 2 + 0.00122874 * T ** 2 * RH
        + 0.00085282 * T * RH ** 2 - 0.00000199 * T ** 2 * RH ** 2
    )
    return (HI - 32) * 5 / 9


def _rule_based_probability(temp: float, humidity: float) -> float:
    """Fallback rule-based estimator when no model is available."""
    import math
    hi = _compute_heat_index(temp, humidity)
    # Sigmoid centred at HI=42°C
    prob = 1 / (1 + math.exp(-0.35 * (hi - 42)))
    return round(prob * 100, 1)


def predict_heatwave(features: dict) -> dict:
    """
    Predict heatwave probability from input features.

    Parameters (all floats unless noted):
        temperature, max_temperature, min_temperature, humidity,
        wind_speed, pressure, solar_radiation, precipitation, dew_point,
        latitude, longitude, day_of_year, month
    """
    _load()

    temp = features.get("temperature", 35)
    hum = features.get("humidity", 60)
    max_temp = features.get("max_temperature", temp + 3)
    min_temp = features.get("min_temperature", temp - 4)
    lat = features.get("latitude", 17.385)
    lon = features.get("longitude", 78.486)

    hi = _compute_heat_index(temp, hum)
    doy = features.get("day_of_year", 180)
    month = features.get("month", 6)

    enriched = {
        "temperature": temp,
        "max_temperature": max_temp,
        "min_temperature": min_temp,
        "humidity": hum,
        "wind_speed": features.get("wind_speed", 10),
        "pressure": features.get("pressure", 1005),
        "solar_radiation": features.get("solar_radiation", 700),
        "precipitation": features.get("precipitation", 0),
        "dew_point": features.get("dew_point", temp - (100 - hum) / 5),
        "latitude": lat,
        "longitude": lon,
        "day_of_year": doy,
        "month": month,
        "heat_index": hi,
        "temp_humidity_interaction": temp * hum / 100,
        "temp_anomaly": features.get("temp_anomaly", 0),
        "rolling_avg_temp": features.get("rolling_avg_temp", temp),
        "rolling_max_temp": features.get("rolling_max_temp", max_temp),
        "recent_heatwave_count": features.get("recent_heatwave_count", 0),
    }

    if _model is not None and _pipeline is not None:
        import numpy as np
        X = np.array([[enriched[c] for c in FEATURE_COLS]])
        X_proc = _pipeline.transform(X)
        prob = float(_model.predict_proba(X_proc)[0][1]) * 100
        model_source = "ml_model"
    else:
        prob = _rule_based_probability(temp, hum)
        model_source = "rule_based_fallback"

    # Classification
    if prob >= 85:
        classification = "Heatwave Very Likely"
        risk = "EXTREME"
    elif prob >= 70:
        classification = "Heatwave Likely"
        risk = "HIGH"
    elif prob >= 50:
        classification = "Heatwave Possible"
        risk = "MODERATE"
    elif prob >= 30:
        classification = "Low Heatwave Probability"
        risk = "LOW"
    else:
        classification = "No Significant Heatwave Signal"
        risk = "LOW"

    # Build explanation from top contributing features
    explanation_points = []
    if temp >= 42:
        explanation_points.append("Temperature is significantly above normal.")
    if hi > 45:
        explanation_points.append("Heat Index is dangerously high.")
    if hum > 60:
        explanation_points.append("High humidity is amplifying heat stress.")
    if enriched.get("recent_heatwave_count", 0) > 2:
        explanation_points.append("Recent consecutive heatwave days detected.")
    if not explanation_points:
        explanation_points.append("Conditions are within elevated but manageable range.")

    return {
        "heatwave_probability": round(prob, 1),
        "classification": classification,
        "risk_level": risk,
        "heat_index": round(hi, 1),
        "explanation": explanation_points,
        "model_source": model_source,
        "features_used": enriched,
        "note": (
            "Heatwave prediction evaluated dynamically using live Open-Meteo environmental inputs."
        ),
    }


def get_model_metrics() -> Optional[dict]:
    _load()
    return _metrics
