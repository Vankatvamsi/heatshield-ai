import math
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.database.models import SOSEvent
from app.schemas.sos import SOSCreate

def get_mock_facilities(latitude: float, longitude: float) -> List[Dict[str, Any]]:
    """
    Mock integration for places API.
    In a real scenario, this would call Google Places or Overpass API
    with the API key from config.
    """
    return [
        {
            "id": "fac_1",
            "name": "City General Hospital",
            "type": "Emergency Medical Assistance",
            "distance_km": 1.2,
            "latitude": latitude + 0.01,
            "longitude": longitude + 0.01,
            "address": "123 Main St, City",
            "phone": "+1-555-0100",
            "rating": 4.5,
            "is_open": True
        },
        {
            "id": "fac_2",
            "name": "Community Cooling Center",
            "type": "Heat Relief",
            "distance_km": 0.8,
            "latitude": latitude - 0.005,
            "longitude": longitude + 0.005,
            "address": "456 Oak St, City",
            "phone": None,
            "rating": 4.2,
            "is_open": True
        },
        {
            "id": "fac_3",
            "name": "Local First-Aid Clinic",
            "type": "Other Useful Assistance",
            "distance_km": 2.5,
            "latitude": latitude + 0.02,
            "longitude": longitude - 0.015,
            "address": "789 Pine St, City",
            "phone": "+1-555-0200",
            "rating": 4.0,
            "is_open": True
        }
    ]

from app.utils.config import get_settings
import logging

settings = get_settings()
logger = logging.getLogger(__name__)

def create_sos_event(db: Session, user_id: Optional[int], data: SOSCreate) -> SOSEvent:
    if user_id:
        existing = db.query(SOSEvent).filter(
            SOSEvent.user_id == user_id, 
            SOSEvent.status == "ACTIVE"
        ).first()
        if existing:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="An SOS is already active.")

    facilities = get_mock_facilities(data.latitude, data.longitude)
    facilities.sort(key=lambda x: (x["type"] != "Emergency Medical Assistance", x["distance_km"]))
    nearest = facilities[0] if facilities else None

    # Format number to E.164 if it doesn't start with '+'
    emergency_contact_phone = settings.DEMO_EMERGENCY_CONTACT or "+919827500473"
    if emergency_contact_phone and not emergency_contact_phone.startswith("+"):
        # Defaulting to India code +91 for this demo if missing
        emergency_contact_phone = f"+91{emergency_contact_phone}"

    hospital_status = "SIMULATED"
    
    logger.info(f"DEMO_EMERGENCY_CONTACT configured: {'yes' if settings.DEMO_EMERGENCY_CONTACT else 'no'} (using: {emergency_contact_phone})")

    loc_str = data.address if data.address else f"{data.latitude},{data.longitude}"
    hosp_str = nearest['name'] if nearest else "None found"
    
    msg_body = (
        f"HEATSHIELD AI SOS\n\n"
        f"A person has triggered a heat emergency.\n\n"
        f"Location: {loc_str}\n"
        f"Heat Risk: {data.heatwave_risk_level}\n"
        f"Thermal Stress: {data.thermal_stress}/100\n"
        f"Temperature: {data.temperature}°C\n"
        f"Humidity: {data.humidity}%\n"
        f"Nearby Hospital: {hosp_str}\n"
        f"Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}\n\n"
        f"Please check on the person immediately."
    )
    
    # Simulate sending SMS and Call
    sms_status = "SIMULATED"
    call_status = "SIMULATED"

    sos_event = SOSEvent(
        user_id=user_id,
        latitude=data.latitude,
        longitude=data.longitude,
        address=data.address,
        temperature=data.temperature,
        humidity=data.humidity,
        wind_speed=data.wind_speed,
        solar_radiation=data.solar_radiation,
        heatwave_probability=data.heatwave_probability,
        heatwave_risk_level=data.heatwave_risk_level,
        thermal_stress=data.thermal_stress,
        personal_risk_score=data.personal_risk_score,
        vulnerability_category=data.vulnerability_category,
        nearest_facility_id=nearest["id"] if nearest else None,
        nearest_facility_name=nearest["name"] if nearest else None,
        nearest_facility_type=nearest["type"] if nearest else None,
        nearest_facility_distance_km=nearest["distance_km"] if nearest else None,
        hospital_notification_status=hospital_status,
        emergency_contact_phone=emergency_contact_phone,
        emergency_contact_notification_status=sms_status,
        sms_timestamp=datetime.utcnow() if sms_status == "SIMULATED" else None,
        status="ACTIVE",
    )
    db.add(sos_event)
    db.commit()
    db.refresh(sos_event)
    return sos_event

def get_sos_event(db: Session, sos_id: int, user_id: Optional[int] = None) -> SOSEvent:
    query = db.query(SOSEvent).filter(SOSEvent.id == sos_id)
    if user_id:
        query = query.filter(SOSEvent.user_id == user_id)
    return query.first()

def get_nearby_facilities(latitude: float, longitude: float) -> List[Dict[str, Any]]:
    facilities = get_mock_facilities(latitude, longitude)
    facilities.sort(key=lambda x: (x["type"] != "Emergency Medical Assistance", x["distance_km"]))
    return facilities

def resolve_sos_event(db: Session, sos_id: int, user_id: Optional[int], status: str) -> SOSEvent:
    event = get_sos_event(db, sos_id, user_id)
    if event:
        event.status = status
        event.resolved_at = datetime.utcnow()
        db.commit()
        db.refresh(event)
    return event
