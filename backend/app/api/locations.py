"""
HeatShield AI – Locations API Router
GET  /api/locations           – List saved locations
POST /api/locations           – Save a new location to PostgreSQL
GET  /api/locations/search    – Search locations via Open-Meteo Geocoding
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.models import Location
from app.database.session import get_db
from app.services.geocoding_service import GeocodingError, search_locations

router = APIRouter(prefix="/api/locations", tags=["locations"])


class LocationCreate(BaseModel):
    name: str
    latitude: float
    longitude: float
    city: str = ""
    state: str = ""
    country: str = ""
    timezone: str = ""


@router.get("")
def get_locations(db: Session = Depends(get_db)):
    """Return all saved locations from PostgreSQL."""
    locs = db.query(Location).filter(Location.is_active == True).all()
    return [
        {
            "id": l.id,
            "name": l.name,
            "city": l.city,
            "state": l.state,
            "country": l.country,
            "latitude": l.latitude,
            "longitude": l.longitude,
            "timezone": l.timezone,
        }
        for l in locs
    ]


@router.get("/search")
def search(q: str = Query(..., min_length=2, description="Location search query")):
    """
    Search for locations using Open-Meteo Geocoding API.
    Returns up to 10 results with name, lat, lon, country, admin1.
    """
    try:
        results = search_locations(q, count=10)
        return {"status": "ok", "count": len(results), "data": results}
    except GeocodingError as e:
        raise HTTPException(status_code=503, detail=f"Geocoding service unavailable: {e}")
    except Exception as e:
        raise HTTPException(status_code=503, detail="Location search is currently unavailable.")


@router.post("", status_code=201)
def add_location(body: LocationCreate, db: Session = Depends(get_db)):
    """
    Save a location to PostgreSQL.
    The frontend calls this after the user selects a geocoded result.
    """
    # Check for duplicate (same lat/lon within ~0.01 degrees)
    existing = (
        db.query(Location)
        .filter(
            Location.latitude.between(body.latitude - 0.01, body.latitude + 0.01),
            Location.longitude.between(body.longitude - 0.01, body.longitude + 0.01),
        )
        .first()
    )
    if existing:
        return {
            "status": "exists",
            "message": "Location already saved.",
            "location": {
                "id": existing.id,
                "name": existing.name,
                "city": existing.city,
                "latitude": existing.latitude,
                "longitude": existing.longitude,
            },
        }

    loc = Location(
        name=body.name,
        latitude=body.latitude,
        longitude=body.longitude,
        city=body.city or body.name,
        state=body.state,
        country=body.country,
        timezone=body.timezone,
        is_active=True,
    )
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return {
        "status": "created",
        "location": {
            "id": loc.id,
            "name": loc.name,
            "city": loc.city,
            "state": loc.state,
            "country": loc.country,
            "latitude": loc.latitude,
            "longitude": loc.longitude,
        },
    }
