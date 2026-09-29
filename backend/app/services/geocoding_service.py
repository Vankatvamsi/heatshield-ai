"""
HeatShield AI – Geocoding Service
==================================
Uses Open-Meteo Geocoding API (https://geocoding-api.open-meteo.com/v1/search).
No API key required.

Returns structured location data (name, latitude, longitude, country, admin1).
"""
from typing import Optional

import httpx

GEOCODING_BASE = "https://geocoding-api.open-meteo.com/v1/search"
TIMEOUT_SECONDS = 10


class GeocodingError(Exception):
    """Raised when geocoding fails."""
    pass


def search_locations(query: str, count: int = 10) -> list[dict]:
    """
    Search for locations by name using Open-Meteo Geocoding API.

    Parameters
    ----------
    query : str – City or location name to search
    count : int – Maximum number of results to return (default 10)

    Returns
    -------
    List of dicts with keys: name, latitude, longitude, country, admin1, id

    Raises
    ------
    GeocodingError – if the API call fails
    """
    if not query or len(query.strip()) < 2:
        return []

    params = {
        "name": query.strip(),
        "count": count,
        "language": "en",
        "format": "json",
    }

    try:
        with httpx.Client(timeout=TIMEOUT_SECONDS) as client:
            response = client.get(GEOCODING_BASE, params=params)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as e:
        raise GeocodingError(
            f"Open-Meteo Geocoding API returned HTTP {e.response.status_code}"
        )
    except httpx.RequestError as e:
        raise GeocodingError(f"Network error contacting Open-Meteo Geocoding: {e}")
    except Exception as e:
        raise GeocodingError(f"Unexpected geocoding error: {e}")

    results = data.get("results", [])
    if not results:
        return []

    locations = []
    for r in results:
        lat = r.get("latitude")
        lon = r.get("longitude")
        if lat is None or lon is None:
            continue
        locations.append({
            "name": r.get("name", ""),
            "latitude": float(lat),
            "longitude": float(lon),
            "country": r.get("country", ""),
            "country_code": r.get("country_code", ""),
            "admin1": r.get("admin1", ""),      # State / region
            "admin2": r.get("admin2", ""),      # District
            "display_name": _build_display_name(r),
            "population": r.get("population"),
            "timezone": r.get("timezone", ""),
        })

    return locations


def _build_display_name(r: dict) -> str:
    """Build a human-readable display name from geocoding result."""
    parts = [r.get("name", "")]
    if r.get("admin1"):
        parts.append(r["admin1"])
    if r.get("country"):
        parts.append(r["country"])
    return ", ".join(p for p in parts if p)
