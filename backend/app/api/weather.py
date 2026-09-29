"""
HeatShield AI – Weather API Router
GET /api/weather/current?city=Hyderabad&lat=17.385&lon=78.486
GET /api/weather/forecast?city=Hyderabad&lat=17.385&lon=78.486
"""
from fastapi import APIRouter, HTTPException, Query

from app.services.weather_service import WeatherUnavailableError, get_current_weather, get_forecast

router = APIRouter(prefix="/api/weather", tags=["weather"])

UNAVAILABLE_MSG = "Live weather data is currently unavailable. Please try again later."


@router.get("/current")
def current_weather(
    city: str = Query("Hyderabad"),
    lat: float = Query(17.385),
    lon: float = Query(78.486),
):
    """Fetch current weather from Open-Meteo for the given coordinates."""
    try:
        data = get_current_weather(lat, lon, city=city)
        return {"status": "ok", "data_source": "Open-Meteo", "data": data}
    except WeatherUnavailableError as e:
        raise HTTPException(
            status_code=503,
            detail=UNAVAILABLE_MSG,
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=UNAVAILABLE_MSG)


@router.get("/forecast")
def forecast(
    city: str = Query("Hyderabad"),
    lat: float = Query(17.385),
    lon: float = Query(78.486),
):
    """Fetch hourly forecast from Open-Meteo for +6h, +12h, +24h, +48h."""
    try:
        data = get_forecast(lat, lon, city=city)
        return {"status": "ok", "data_source": "Open-Meteo", "data": data}
    except WeatherUnavailableError as e:
        raise HTTPException(
            status_code=503,
            detail=UNAVAILABLE_MSG,
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=UNAVAILABLE_MSG)
