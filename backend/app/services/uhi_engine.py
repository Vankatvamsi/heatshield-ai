"""
HeatShield AI – Urban Heat Island Engine
Computes UHI intensity and classifies hotspots.

If real satellite / land-cover data is unavailable, the engine
uses a demo model based on urbanisation proxy features.

NOTE: All values labelled "demo" are not satellite-derived.
The code is structured so real NDVI / land-cover data can be
plugged in by replacing the _estimate_reference_temp function.
"""
import math
import random
from typing import Optional


# ─── Demo UHI coefficients ───────────────────────────────────────────────────
# In a real system these would come from land-cover/NDVI indices.
URBAN_HEAT_BIAS = {
    "CBD": 3.5,
    "Industrial": 3.0,
    "Residential": 2.0,
    "Mixed": 2.5,
    "Peri-urban": 1.0,
    "Green": 0.2,
}


def compute_uhi(
    urban_temp: float,
    reference_temp: Optional[float] = None,
    land_cover: str = "CBD",
    vegetation_index: float = 0.2,   # 0=bare, 1=fully vegetated (NDVI proxy)
    is_demo: bool = True,
) -> dict:
    """
    Calculate Urban Heat Island intensity.

    Parameters
    ----------
    urban_temp      : Air temperature at the urban site (°C)
    reference_temp  : Temperature at a rural/reference site (°C). If None,
                      estimated from a demo model.
    land_cover      : Land-cover class string
    vegetation_index: NDVI proxy (0-1)
    is_demo         : Flag to surface in the response

    Returns
    -------
    dict with uhi_intensity, classification, risk_level, etc.
    """
    if reference_temp is None:
        reference_temp = _estimate_reference_temp(urban_temp, land_cover, vegetation_index)

    uhi_intensity = round(urban_temp - reference_temp, 2)

    if uhi_intensity < 1.0:
        classification = "Minimal UHI"
        risk = "LOW"
    elif uhi_intensity < 2.0:
        classification = "Weak Urban Heat Island"
        risk = "MODERATE"
    elif uhi_intensity < 3.0:
        classification = "Moderate Urban Heat Island"
        risk = "HIGH"
    elif uhi_intensity < 4.5:
        classification = "Strong Urban Heat Island"
        risk = "HIGH"
    else:
        classification = "Very Strong Urban Heat Island"
        risk = "EXTREME"

    return {
        "urban_temperature": round(urban_temp, 2),
        "reference_temperature": round(reference_temp, 2),
        "uhi_intensity": uhi_intensity,
        "classification": classification,
        "risk_level": risk,
        "land_cover": land_cover,
        "vegetation_index": vegetation_index,
        "data_source": "demo_model" if is_demo else "satellite",
        "note": (
            "Demo UHI estimate – not derived from satellite/land-cover data. "
            "Structure is ready for real data integration."
        ) if is_demo else "Satellite-derived UHI estimate.",
    }


def _estimate_reference_temp(urban_temp: float, land_cover: str, vegetation_index: float) -> float:
    """
    Estimate reference (rural/green) temperature using a simple demo model.
    In production, replace with actual rural weather station or remote-sensing data.
    """
    bias = URBAN_HEAT_BIAS.get(land_cover, 2.0)
    # Vegetation cools by up to 2°C
    veg_cooling = vegetation_index * 2.0
    ref = urban_temp - bias + veg_cooling
    return round(ref, 2)


def get_demo_hotspots(
    city: str = "Hyderabad",
    base_temp: float = 40.0,
    lat: float = 17.385,
    lon: float = 78.486
) -> list[dict]:
    """
    Return a list of demo UHI hotspot records centered around the selected city coordinates.
    """
    # Seed with hash of city to get consistent hotspots per city
    random.seed(hash(city) % 10000)
    
    # Generic relative hotspot configurations
    spots = [
        {"name": f"{city} Downtown CBD", "lat_offset": -0.025, "lon_offset": -0.01, "land_cover": "CBD"},
        {"name": f"{city} Industrial Zone", "lat_offset": 0.11, "lon_offset": -0.15, "land_cover": "Industrial"},
        {"name": f"{city} Tech Corridor / IT Hub", "lat_offset": 0.065, "lon_offset": -0.105, "land_cover": "Mixed"},
        {"name": f"{city} Residential Sector A", "lat_offset": 0.058, "lon_offset": 0.013, "land_cover": "Residential"},
        {"name": f"{city} Outer Highway Bypass", "lat_offset": 0.11, "lon_offset": -0.171, "land_cover": "Peri-urban"},
        {"name": f"{city} Botanical Reserve & Park", "lat_offset": -0.034, "lon_offset": -0.035, "land_cover": "Green"},
    ]
    results = []
    for spot in spots:
        temp = base_temp + random.uniform(-1, 2)
        veg = 0.7 if spot["land_cover"] == "Green" else random.uniform(0.05, 0.35)
        uhi = compute_uhi(temp, land_cover=spot["land_cover"], vegetation_index=veg)
        results.append({
            "name": spot["name"],
            "latitude": round(lat + spot["lat_offset"], 4),
            "longitude": round(lon + spot["lon_offset"], 4),
            **uhi,
        })
    return results
