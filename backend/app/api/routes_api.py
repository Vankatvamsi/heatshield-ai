"""
HeatShield AI – Heat-Safe Route Planner & Journey Health Check Router (Feature 10)
==================================================================================
Endpoints:
  POST /api/routes/plan              — Generate & evaluate road routes with live/forecast heat risk
  GET  /api/routes/{journey_id}      — Retrieve saved journey and segment risk evaluations
  POST /api/journeys/start           — Start live journey monitoring
  POST /api/journeys/location        — Send live GPS during journey, detect segment, deviation & arrival
  POST /api/journeys/complete        — Stop / complete active journey
  POST /api/journeys/feedback        — Destination health check feedback (FINE, UNCOMFORTABLE, VERY_HOT, UNWELL)
  GET  /api/journeys/history         — List user's past journeys
"""
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.personal_profile_api import get_current_user, get_optional_user
from app.database.models import (
    Alert, Journey, JourneyHealthFeedback, Location, RouteRiskSegment,
    User, UserHealthSensitivity, UserProfile
)
from app.database.session import get_db
from app.services.personal_risk_engine import calculate_personal_risk
from app.services.route_planner_service import (
    DESTINATION_ARRIVAL_RADIUS_METERS, ROUTE_DEVIATION_THRESHOLD_METERS,
    find_active_route_segment, haversine_distance_meters, plan_heat_safe_routes
)
from app.services.weather_service import get_current_weather

logger = logging.getLogger("heatshield.routes_api")
router = APIRouter(prefix="/api", tags=["route-planner"])


# ── Pydantic Request & Response Schemas ────────────────────────────────────────

class RoutePlanRequest(BaseModel):
    start_name: Optional[str] = "Current Location"
    start_latitude: float = Field(..., json_schema_extra={"example": 17.385})
    start_longitude: float = Field(..., json_schema_extra={"example": 78.486})
    destination_name: Optional[str] = "Destination"
    destination_latitude: float = Field(..., json_schema_extra={"example": 17.3616})
    destination_longitude: float = Field(..., json_schema_extra={"example": 78.4744})
    departure_time: Optional[str] = "now"  # "now" or ISO/hour string
    # Optional what-if simulation overrides
    age_group: Optional[str] = None
    vulnerability_category: Optional[str] = None
    activity_level: Optional[str] = None
    water_access: Optional[str] = None
    heat_sensitivity: Optional[str] = None
    health_sensitivities: Optional[List[str]] = None


class JourneyStartRequest(BaseModel):
    start_location: str
    start_latitude: float
    start_longitude: float
    destination: str
    destination_latitude: float
    destination_longitude: float
    selected_route: Dict[str, Any]


class JourneyLocationRequest(BaseModel):
    journey_id: int
    latitude: float
    longitude: float


class JourneyFeedbackRequest(BaseModel):
    journey_id: int
    feedback_level: str = Field(..., json_schema_extra={"example": "FINE"})  # FINE | UNCOMFORTABLE | VERY_HOT | UNWELL


# ── Route Planning Endpoint ───────────────────────────────────────────────────

@router.post("/routes/plan")
def plan_route(
    req: RoutePlanRequest,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """
    Generate road routes between start and destination, sample segments,
    evaluate live/forecast weather, Steadman thermal stress, and recommend the heat-safe path.
    """
    user_profile = None
    health_sens: List[str] = []

    if current_user:
        profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
        if profile:
            user_profile = {
                "age_group": profile.age_group,
                "vulnerability_category": profile.vulnerability_category,
                "activity_level": profile.activity_level,
                "water_access": profile.water_access,
                "heat_sensitivity": profile.heat_sensitivity,
            }
        sens_records = db.query(UserHealthSensitivity).filter(UserHealthSensitivity.user_id == current_user.id).all()
        health_sens = [r.sensitivity_type for r in sens_records]

    # Apply request overrides if provided
    if req.age_group or req.vulnerability_category or req.activity_level or req.water_access or req.heat_sensitivity:
        user_profile = user_profile or {}
        if req.age_group: user_profile["age_group"] = req.age_group
        if req.vulnerability_category: user_profile["vulnerability_category"] = req.vulnerability_category
        if req.activity_level: user_profile["activity_level"] = req.activity_level
        if req.water_access: user_profile["water_access"] = req.water_access
        if req.heat_sensitivity: user_profile["heat_sensitivity"] = req.heat_sensitivity

    if req.health_sensitivities is not None:
        health_sens = req.health_sensitivities

    result = plan_heat_safe_routes(
        start_lat=req.start_latitude,
        start_lon=req.start_longitude,
        start_name=req.start_name or "Starting Point",
        dest_lat=req.destination_latitude,
        dest_lon=req.destination_longitude,
        dest_name=req.destination_name or "Destination",
        user_profile=user_profile,
        health_sensitivities=health_sens,
        departure_time=req.departure_time,
    )

    return {"status": "ok", "data": result}


# ── Journey Management Endpoints ──────────────────────────────────────────────

@router.post("/journeys/start")
def start_journey(
    req: JourneyStartRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Starts an active journey monitoring session in PostgreSQL.
    Saves the planned route segments and sets status to ACTIVE.
    """
    # 1. Close any existing active journeys for this user
    active_journeys = (
        db.query(Journey)
        .filter(Journey.user_id == current_user.id, Journey.status == "ACTIVE")
        .all()
    )
    for j in active_journeys:
        j.status = "CANCELLED"
        j.ended_at = datetime.utcnow()
    db.commit()

    # 2. Create new Journey
    journey = Journey(
        user_id=current_user.id,
        start_location=req.start_location,
        start_latitude=req.start_latitude,
        start_longitude=req.start_longitude,
        destination=req.destination,
        destination_latitude=req.destination_latitude,
        destination_longitude=req.destination_longitude,
        started_at=datetime.utcnow(),
        status="ACTIVE",
        recommended_route=json.dumps(req.selected_route),
    )
    db.add(journey)
    db.commit()
    db.refresh(journey)

    # 3. Save initial route risk segments
    segments_data = req.selected_route.get("segments", [])
    for seg in segments_data:
        seg_record = RouteRiskSegment(
            journey_id=journey.id,
            segment_index=seg.get("segment_index", 0),
            latitude=seg.get("midpoint", [0, 0])[0],
            longitude=seg.get("midpoint", [0, 0])[1],
            temperature=seg.get("temperature", 30.0),
            humidity=seg.get("humidity", 50.0),
            thermal_stress_score=seg.get("thermal_stress_score", 0.0),
            heatwave_probability=seg.get("heatwave_probability", 0.0),
            risk_score=seg.get("personal_risk_score", 0.0),
            risk_level=seg.get("personal_risk_level", "LOW"),
            estimated_time=seg.get("estimated_time", ""),
        )
        db.add(seg_record)
    db.commit()

    return {
        "status": "ok",
        "message": f"Journey monitoring started for trip to {req.destination}.",
        "journey_id": journey.id,
        "started_at": journey.started_at.isoformat(),
    }


@router.post("/journeys/location")
def update_journey_location(
    req: JourneyLocationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Ingests live GPS coordinates during active journey monitoring.
    - Evaluates proximity to destination (triggers health check when arrived)
    - Determines active route segment
    - Detects route deviation and suggests recalculation
    - Computes real-time personal heat risk and triggers escalation alerts if needed
    """
    journey = db.query(Journey).filter(Journey.id == req.journey_id).first()
    if not journey:
        raise HTTPException(status_code=404, detail="Journey not found")

    if journey.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized access to this journey")

    if journey.status != "ACTIVE":
        return {
            "status": journey.status,
            "message": f"Journey is already {journey.status.lower()}.",
            "arrived": journey.status == "COMPLETED",
        }

    # 1. Check if user has arrived at destination
    dist_to_dest = haversine_distance_meters(
        req.latitude, req.longitude,
        journey.destination_latitude, journey.destination_longitude
    )

    arrived = dist_to_dest <= DESTINATION_ARRIVAL_RADIUS_METERS

    if arrived:
        journey.status = "COMPLETED"
        journey.ended_at = datetime.utcnow()
        db.commit()
        return {
            "status": "COMPLETED",
            "arrived": True,
            "distance_to_destination_m": round(dist_to_dest, 1),
            "message": "You have arrived at your destination! Please complete your Journey Health Check.",
        }

    # 2. Match active route segment from saved route
    saved_route_data = json.loads(journey.recommended_route or "{}")
    segments = saved_route_data.get("segments", [])

    active_seg_idx, min_dist_to_route = find_active_route_segment(
        req.latitude, req.longitude, segments
    )

    # 3. Detect Route Deviation
    route_deviated = min_dist_to_route > ROUTE_DEVIATION_THRESHOLD_METERS

    # 4. Fetch live weather and evaluate active personal heat risk
    weather = get_current_weather(lat=req.latitude, lon=req.longitude, city="Live Journey GPS")
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    sens_records = db.query(UserHealthSensitivity).filter(UserHealthSensitivity.user_id == current_user.id).all()
    health_sens = [r.sensitivity_type for r in sens_records]

    risk_res = calculate_personal_risk(
        temperature=weather["temperature"],
        humidity=weather["humidity"],
        wind_speed=weather["wind_speed"],
        solar_radiation=weather["solar_radiation"],
        heatwave_probability=0.0,
        age_group=profile.age_group if profile else "18-44",
        vulnerability_category=profile.vulnerability_category if profile else "General Population",
        activity_level=profile.activity_level if profile else "Moderate Outdoor Activity",
        water_access=profile.water_access if profile else "Always available",
        heat_sensitivity=profile.heat_sensitivity if profile else "No",
        health_sensitivities=health_sens,
    )

    # 5. Check risk escalation (e.g. HIGH or EXTREME during travel)
    escalation_alert = None
    if risk_res["personal_risk_level"] in ("HIGH", "EXTREME"):
        escalation_alert = (
            f"🚨 Elevated Heat Risk During Journey ({risk_res['personal_risk_level']}): "
            f"Ambient {weather['temperature']:.1f}°C with {weather['humidity']:.0f}% humidity. "
            f"Hydrate now and seek shaded rest breaks."
        )

    return {
        "status": "ACTIVE",
        "arrived": False,
        "distance_to_destination_m": round(dist_to_dest, 1),
        "active_segment_index": active_seg_idx,
        "route_deviated": route_deviated,
        "deviation_message": "Your route has changed. Heat risk is being recalculated." if route_deviated else None,
        "current_weather": {
            "temperature": weather["temperature"],
            "humidity": weather["humidity"],
            "wind_speed": weather["wind_speed"],
        },
        "personal_risk": {
            "score": risk_res["personal_risk_score"],
            "level": risk_res["personal_risk_level"],
            "thermal_stress": risk_res["thermal_stress_score"],
        },
        "escalation_alert": escalation_alert,
    }


@router.post("/journeys/complete")
def complete_journey(
    journey_id: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Ends active journey monitoring."""
    journey = db.query(Journey).filter(Journey.id == journey_id).first()
    if not journey:
        raise HTTPException(status_code=404, detail="Journey not found")
    if journey.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    journey.status = "COMPLETED"
    journey.ended_at = datetime.utcnow()
    db.commit()

    return {
        "status": "ok",
        "message": "Journey completed successfully.",
        "journey_id": journey.id,
    }


@router.post("/journeys/feedback")
def submit_journey_feedback(
    req: JourneyFeedbackRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Submits destination health check feedback:
    Options: FINE | UNCOMFORTABLE | VERY_HOT | UNWELL
    Provides tailored, non-diagnostic recovery advice.
    """
    journey = db.query(Journey).filter(Journey.id == req.journey_id).first()
    if not journey:
        raise HTTPException(status_code=404, detail="Journey not found")

    level = req.feedback_level.upper().strip()
    if level not in ("FINE", "UNCOMFORTABLE", "VERY_HOT", "UNWELL"):
        level = "FINE"

    # Save feedback record in PostgreSQL
    feedback = JourneyHealthFeedback(
        user_id=current_user.id,
        journey_id=req.journey_id,
        feedback_level=level,
        timestamp=datetime.utcnow(),
    )
    db.add(feedback)
    db.commit()

    # Guidance message based on feedback
    if level == "FINE":
        guidance = "Glad you're feeling okay. Continue staying hydrated and take appropriate precautions in hot conditions."
        badge = "😊 ALL GOOD"
    elif level == "UNCOMFORTABLE":
        guidance = "Consider resting in a cool or shaded place and drinking water if available."
        badge = "😐 REST RECOMMENDED"
    elif level == "VERY_HOT":
        guidance = "Move to a cooler/shaded environment, reduce physical activity, and hydrate if possible."
        badge = "🥵 COOL DOWN"
    else:  # UNWELL
        guidance = (
            "Stop strenuous activity and move to a cool environment. "
            "If symptoms are severe, worsening, or concerning, seek appropriate medical assistance."
        )
        badge = "⚠️ SEEK MEDICAL ATTENTION"

    return {
        "status": "ok",
        "feedback_level": level,
        "badge": badge,
        "guidance": guidance,
        "disclaimer": (
            "HeatShield AI does not diagnose or treat medical conditions. "
            "Follow professional medical advice for persistent symptoms."
        ),
    }


@router.get("/journeys/history")
def list_journey_history(
    limit: int = Query(10),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns user's recent journey history from PostgreSQL."""
    journeys = (
        db.query(Journey)
        .filter(Journey.user_id == current_user.id)
        .order_by(Journey.created_at.desc())
        .limit(limit)
        .all()
    )

    results = []
    for j in journeys:
        results.append({
            "id": j.id,
            "start_location": j.start_location,
            "destination": j.destination,
            "status": j.status,
            "started_at": j.started_at.isoformat() if j.started_at else None,
            "ended_at": j.ended_at.isoformat() if j.ended_at else None,
            "created_at": j.created_at.isoformat() if j.created_at else None,
        })

    return {"status": "ok", "data": results, "count": len(results)}


@router.get("/routes/{journey_id}")
def get_journey_route_details(
    journey_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve full journey details, selected route, and saved risk segments."""
    journey = db.query(Journey).filter(Journey.id == journey_id).first()
    if not journey:
        raise HTTPException(status_code=404, detail="Journey not found")

    if journey.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    segments = db.query(RouteRiskSegment).filter(RouteRiskSegment.journey_id == journey.id).order_by(RouteRiskSegment.segment_index.asc()).all()

    return {
        "journey_id": journey.id,
        "start": journey.start_location,
        "destination": journey.destination,
        "status": journey.status,
        "started_at": journey.started_at.isoformat() if journey.started_at else None,
        "ended_at": journey.ended_at.isoformat() if journey.ended_at else None,
        "recommended_route": json.loads(journey.recommended_route or "{}"),
        "segments": [
            {
                "segment_index": s.segment_index,
                "latitude": s.latitude,
                "longitude": s.longitude,
                "temperature": s.temperature,
                "humidity": s.humidity,
                "thermal_stress_score": s.thermal_stress_score,
                "heatwave_probability": s.heatwave_probability,
                "risk_score": s.risk_score,
                "risk_level": s.risk_level,
                "estimated_time": s.estimated_time,
            }
            for s in segments
        ],
    }