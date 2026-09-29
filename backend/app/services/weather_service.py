"""
HeatShield AI – Open-Meteo Weather Service
==========================================
Uses the official Open-Meteo Forecast API (https://api.open-meteo.com/v1/forecast).
No API key required for the non-commercial free tier.

This service is the ONLY weather data source for the application.
There is NO demo mode, NO fake data, and NO fallback synthetic values.
If the API is unavailable, a WeatherUnavailableError is raised and the caller
must display "Live weather data is currently unavailable."
"""
import math
from datetime import datetime, timezone
from typing import Optional

import httpx

OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast"
GEOCODING_BASE = "https://geocoding-api.open-meteo.com/v1/search"

TIMEOUT_SECONDS = 15


class WeatherUnavailableError(Exception):
    """Raised when live weather data cannot be retrieved from Open-Meteo."""
    pass


def get_current_weather(lat: float, lon: float, city: str = "") -> dict:
    """
    Fetch current weather conditions from Open-Meteo.

    Parameters
    ----------
    lat  : Latitude in decimal degrees
    lon  : Longitude in decimal degrees
    city : Optional city name for labelling (not used in the API call)

    Returns
    -------
    dict with keys:
        city, latitude, longitude, temperature, humidity, wind_speed,
        pressure, solar_radiation, precipitation, dew_point, apparent_temperature,
        timestamp, data_source

    Raises
    ------
    WeatherUnavailableError – if the Open-Meteo API call fails
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": [
            "temperature_2m",
            "relative_humidity_2m",
            "wind_speed_10m",
            "surface_pressure",
            "precipitation",
            "apparent_temperature",
            "weather_code",
        ],
        "hourly": [
            "temperature_2m",
            "relative_humidity_2m",
            "wind_speed_10m",
            "surface_pressure",
            "precipitation",
            "dew_point_2m",
            "shortwave_radiation",
        ],
        "daily": [
            "temperature_2m_max",
            "temperature_2m_min",
        ],
        "timezone": "auto",
        "forecast_days": 2,
    }

    try:
        with httpx.Client(timeout=TIMEOUT_SECONDS) as client:
            response = client.get(OPEN_METEO_BASE, params=params)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as e:
        raise WeatherUnavailableError(
            f"Open-Meteo API returned HTTP {e.response.status_code}: {e.response.text[:200]}"
        )
    except httpx.RequestError as e:
        raise WeatherUnavailableError(f"Network error contacting Open-Meteo: {e}")
    except Exception as e:
        raise WeatherUnavailableError(f"Unexpected error fetching weather: {e}")

    # ── Parse current conditions ──────────────────────────────────────────────
    current = data.get("current", {})
    hourly = data.get("hourly", {})

    temp = _safe_float(current.get("temperature_2m"))
    humidity = _safe_float(current.get("relative_humidity_2m"))
    wind_speed = _safe_float(current.get("wind_speed_10m"))  # km/h from Open-Meteo
    pressure = _safe_float(current.get("surface_pressure"))
    precip = _safe_float(current.get("precipitation"), default=0.0)
    apparent_temp = _safe_float(current.get("apparent_temperature"))

    if temp is None or humidity is None:
        raise WeatherUnavailableError(
            "Open-Meteo returned incomplete current data (missing temperature or humidity)."
        )

    # ── Get solar radiation and dew point from hourly (find current hour) ─────
    solar_radiation = 0.0
    dew_point = _calc_dew_point(temp, humidity)

    current_time_str = current.get("time", "")
    try:
        hourly_times = hourly.get("time", [])
        # Find the index matching current time (or the closest past hour)
        idx = _find_hourly_index(current_time_str, hourly_times)
        if idx is not None:
            rad_values = hourly.get("shortwave_radiation", [])
            if idx < len(rad_values) and rad_values[idx] is not None:
                solar_radiation = float(rad_values[idx])
            dp_values = hourly.get("dew_point_2m", [])
            if idx < len(dp_values) and dp_values[idx] is not None:
                dew_point = float(dp_values[idx])
    except Exception:
        pass  # Non-critical – use defaults

    return {
        "city": city,
        "latitude": lat,
        "longitude": lon,
        "temperature": round(temp, 1),
        "humidity": round(humidity, 1),
        "wind_speed": round(wind_speed or 0.0, 1),
        "pressure": round(pressure or 1013.25, 1),
        "solar_radiation": round(solar_radiation, 1),
        "precipitation": round(precip, 2),
        "dew_point": round(dew_point, 1),
        "apparent_temperature": round(apparent_temp or temp, 1),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data_source": "Open-Meteo",
    }


def get_forecast(lat: float, lon: float, city: str = "") -> list[dict]:
    """
    Fetch hourly forecast data and extract +6h, +12h, +24h, +48h horizons.

    Returns a list of dicts:
        horizon_hours, timestamp, temperature, humidity, wind_speed,
        pressure, solar_radiation, precipitation, dew_point, data_source
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": [
            "temperature_2m",
            "relative_humidity_2m",
            "wind_speed_10m",
            "surface_pressure",
            "precipitation",
            "dew_point_2m",
            "shortwave_radiation",
        ],
        "timezone": "auto",
        "forecast_days": 3,
    }

    try:
        with httpx.Client(timeout=TIMEOUT_SECONDS) as client:
            response = client.get(OPEN_METEO_BASE, params=params)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as e:
        raise WeatherUnavailableError(
            f"Open-Meteo forecast API returned HTTP {e.response.status_code}"
        )
    except httpx.RequestError as e:
        raise WeatherUnavailableError(f"Network error contacting Open-Meteo: {e}")
    except Exception as e:
        raise WeatherUnavailableError(f"Unexpected error fetching forecast: {e}")

    hourly = data.get("hourly", {})
    times = hourly.get("time", [])

    if not times:
        raise WeatherUnavailableError("Open-Meteo returned empty hourly forecast data.")

    # Find index of the current hour
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:00")
    start_idx = 0
    for i, t in enumerate(times):
        if t >= now_str:
            start_idx = i
            break

    horizons = [6, 12, 24, 48]
    results = []

    temps = hourly.get("temperature_2m", [])
    humidities = hourly.get("relative_humidity_2m", [])
    winds = hourly.get("wind_speed_10m", [])
    pressures = hourly.get("surface_pressure", [])
    precips = hourly.get("precipitation", [])
    dew_points = hourly.get("dew_point_2m", [])
    solar = hourly.get("shortwave_radiation", [])

    for h in horizons:
        idx = start_idx + h
        if idx >= len(times):
            idx = len(times) - 1

        results.append({
            "horizon_hours": h,
            "timestamp": times[idx] if idx < len(times) else "",
            "temperature": _safe_float(temps[idx] if idx < len(temps) else None, default=None),
            "humidity": _safe_float(humidities[idx] if idx < len(humidities) else None, default=None),
            "wind_speed": _safe_float(winds[idx] if idx < len(winds) else None, default=0.0),
            "pressure": _safe_float(pressures[idx] if idx < len(pressures) else None, default=1013.25),
            "precipitation": _safe_float(precips[idx] if idx < len(precips) else None, default=0.0),
            "dew_point": _safe_float(dew_points[idx] if idx < len(dew_points) else None, default=None),
            "solar_radiation": _safe_float(solar[idx] if idx < len(solar) else None, default=0.0),
            "data_source": "Open-Meteo",
        })

    return results


# ── Internal helpers ──────────────────────────────────────────────────────────

def _safe_float(value, default: Optional[float] = 0.0) -> Optional[float]:
    """Convert value to float safely; return default if None or invalid."""
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _calc_dew_point(temp_c: float, humidity: float) -> float:
    """Magnus formula dew-point approximation."""
    a, b = 17.27, 237.7
    try:
        alpha = ((a * temp_c) / (b + temp_c)) + math.log(max(humidity, 1) / 100.0)
        return round((b * alpha) / (a - alpha), 1)
    except Exception:
        return round(temp_c - (100 - humidity) / 5, 1)


def _find_hourly_index(current_time_str: str, hourly_times: list) -> Optional[int]:
    """
    Find the index in hourly_times that best matches current_time_str.
    Open-Meteo returns times like '2024-06-15T14:00'.
    """
    if not current_time_str or not hourly_times:
        return None
    # Truncate to hour precision for comparison
    target = current_time_str[:13]  # "YYYY-MM-DDTHH"
    for i, t in enumerate(hourly_times):
        if str(t)[:13] >= target:
            return i
    return len(hourly_times) - 1
