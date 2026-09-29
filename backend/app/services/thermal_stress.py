"""
HeatShield AI – Thermal Stress Engine
Calculates Heat Index and normalised Human Thermal Stress Score.

DISCLAIMER: The normalised stress score (0-100) is an application-level
risk indicator for decision-support purposes only. It is NOT a medical
diagnosis and must not replace professional health advice.
"""
import math


def heat_index_celsius(temp_c: float, humidity: float) -> float:
    """
    Steadman's Heat Index formula (converted to Celsius).
    Valid for temperature > 27°C and relative humidity > 40%.

    Returns Heat Index in °C.
    """
    # Work in Fahrenheit for the standard formula
    T = temp_c * 9 / 5 + 32
    RH = humidity

    HI = (
        -42.379
        + 2.04901523 * T
        + 10.14333127 * RH
        - 0.22475541 * T * RH
        - 0.00683783 * T ** 2
        - 0.05481717 * RH ** 2
        + 0.00122874 * T ** 2 * RH
        + 0.00085282 * T * RH ** 2
        - 0.00000199 * T ** 2 * RH ** 2
    )

    # Apply adjustment for low humidity
    if RH < 13 and 80 <= T <= 112:
        adjustment = ((13 - RH) / 4) * math.sqrt((17 - abs(T - 95)) / 17)
        HI -= adjustment
    elif RH > 85 and 80 <= T <= 87:
        adjustment = ((RH - 85) / 10) * ((87 - T) / 5)
        HI += adjustment

    # Convert back to Celsius
    return (HI - 32) * 5 / 9


def thermal_stress_score(
    temp_c: float,
    humidity: float,
    wind_speed: float = 0.0,
    solar_radiation: float = 500.0,
) -> dict:
    """
    Compute a normalised Human Thermal Stress Score from 0 to 100.

    Inputs:
        temp_c         – Air temperature in °C
        humidity       – Relative humidity in %
        wind_speed     – Wind speed in km/h (optional, reduces stress)
        solar_radiation – Solar radiation in W/m² (optional, increases stress)

    Returns:
        dict with keys: heat_index, stress_score, category, explanation
    """
    # Calculate heat index
    hi = heat_index_celsius(max(temp_c, 0.0), max(min(humidity, 100.0), 0.0))

    # Base score from heat index (calibrated to 0-100)
    # HI < 27°C → ~0, HI 54°C → ~100
    base_score = max(0.0, (hi - 27) / (54 - 27) * 100)

    # Wind cooling effect (reduces score slightly)
    wind_factor = max(0.0, 1 - (wind_speed * 0.005))

    # Solar radiation penalty (adds ~10 at 1000 W/m²)
    solar_penalty = (solar_radiation / 1000) * 10

    score = min(100.0, max(0.0, base_score * wind_factor + solar_penalty))

    # Categorise
    if score <= 20:
        category = "LOW"
        explanation = "Thermal conditions are comfortable. Minimal heat stress risk."
    elif score <= 40:
        category = "MODERATE"
        explanation = "Moderate thermal stress. Stay hydrated and take breaks in shade."
    elif score <= 60:
        category = "ELEVATED"
        explanation = "Elevated thermal stress. Limit prolonged outdoor activity."
    elif score <= 80:
        category = "HIGH"
        explanation = "High thermal stress. Reduce outdoor exposure and stay cool."
    else:
        category = "EXTREME"
        explanation = (
            "Extreme thermal stress — high risk during prolonged heat exposure. "
            "Seek air-conditioned environments and monitor vulnerable individuals."
        )

    return {
        "heat_index": round(hi, 2),
        "stress_score": round(score, 1),
        "category": category,
        "explanation": explanation,
        "inputs": {
            "temperature": temp_c,
            "humidity": humidity,
            "wind_speed": wind_speed,
            "solar_radiation": solar_radiation,
        },
    }
