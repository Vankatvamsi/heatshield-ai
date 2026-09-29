"""
HeatShield AI – UHI (Urban Heat Island) API Router
GET /api/uhi/hotspots?city=Hyderabad&lat=17.385&lon=78.486
GET /api/uhi/compute

IMPORTANT: The current UHI calculation uses available temperature observations
from Open-Meteo combined with land-cover proxy coefficients.
Satellite-derived Land Surface Temperature (LST), NDVI, and built-up area
data are NOT yet integrated. UHI values are observational estimates.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.database.models import Location
from app.services.uhi_engine import compute_uhi, get_demo_hotspots
from app.services.weather_service import WeatherUnavailableError, get_current_weather

router = APIRouter(prefix="/api/uhi", tags=["uhi"])

_UHI_NOTE = (
    "UHI estimates are based on available temperature observations from Open-Meteo "
    "and land-cover proxy coefficients. Satellite-derived LST/NDVI data not yet integrated. "
    "These are indicative estimates only."
)


@router.get("/hotspots")
def uhi_hotspots(
    city: str = Query("Hyderabad"),
    lat: float = Query(17.385),
    lon: float = Query(78.486),
    db: Session = Depends(get_db),
):
    """
    Return UHI zone estimates for the given location.
    Uses live temperature from Open-Meteo as the base urban temperature.
    If live data is unavailable, returns a clear message instead of fake values.
    """
    # Try to get actual live temperature as base
    try:
        weather = get_current_weather(lat, lon, city=city)
        base_temp = weather["temperature"]
        live_temp_available = True
    except WeatherUnavailableError:
        return {
            "status": "unavailable",
            "message": "Live weather data is currently unavailable. UHI calculation requires live temperature data.",
            "city": city,
            "data": [],
        }
    except Exception:
        live_temp_available = False
        base_temp = None

    if not live_temp_available or base_temp is None:
        return {
            "status": "unavailable",
            "message": "Insufficient data for UHI calculation.",
            "city": city,
            "data": [],
        }

    # Generate UHI zone estimates using live base temperature
    spots = get_demo_hotspots(city=city, base_temp=base_temp, lat=lat, lon=lon)

    # Annotate all spots with the live data note
    for spot in spots:
        spot["data_source"] = "Open-Meteo (observation-based)"
        spot["note"] = _UHI_NOTE
        spot["live_base_temperature"] = base_temp

    return {
        "status": "ok",
        "city": city,
        "live_base_temperature": base_temp,
        "count": len(spots),
        "data_source": "Open-Meteo (observation-based)",
        "note": _UHI_NOTE,
        "data": spots,
    }


@router.get("/compute")
def compute(
    urban_temp: float = Query(..., description="Urban area temperature in °C"),
    reference_temp: float = Query(None, description="Reference rural temperature (optional)"),
    land_cover: str = Query("CBD"),
    vegetation_index: float = Query(0.2),
):
    """
    Compute UHI intensity from provided temperatures.
    If reference_temp is not provided, it is estimated from land-cover proxy.
    """
    result = compute_uhi(
        urban_temp=urban_temp,
        reference_temp=reference_temp,
        land_cover=land_cover,
        vegetation_index=vegetation_index,
        is_demo=False,
    )
    result["note"] = _UHI_NOTE
    result["data_source"] = "User-provided temperatures"
    return {"status": "ok", "data": result}
