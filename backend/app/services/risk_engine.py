"""
HeatShield AI – Risk Classification Engine
Central function to convert heatwave probability, thermal stress,
and temperature into a single risk level.

All thresholds are loaded from config/risk_thresholds.json.
"""
from app.utils.config import get_settings

settings = get_settings()


def classify_risk(
    heatwave_probability: float,
    thermal_stress_score: float,
    temperature: float,
) -> str:
    """
    Determine overall risk level from three key signals.

    Parameters
    ----------
    heatwave_probability : float – 0-100
    thermal_stress_score : float – 0-100
    temperature          : float – °C

    Returns
    -------
    str : "LOW" | "MODERATE" | "HIGH" | "EXTREME"
    """
    thresholds = settings.load_thresholds()
    hp = thresholds["heatwave_probability"]
    ts = thresholds["thermal_stress_score"]
    tc = thresholds["temperature_celsius"]

    # Score each signal
    prob_level = _level(heatwave_probability, hp["low"], hp["moderate"], hp["high"], hp["extreme"])
    stress_level = _level(thermal_stress_score, ts["low"], ts["moderate"], ts["high"], ts["extreme"])
    temp_level = _level(temperature, tc["low"], tc["moderate"], tc["high"], tc["extreme"])

    # Take the maximum
    max_level = max(prob_level, stress_level, temp_level)
    return ["LOW", "MODERATE", "HIGH", "EXTREME"][max_level]


def _level(value: float, low: float, moderate: float, high: float, extreme: float) -> int:
    if value >= extreme:
        return 3
    elif value >= high:
        return 2
    elif value >= moderate:
        return 1
    else:
        return 0
