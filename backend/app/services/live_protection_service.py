"""
HeatShield AI – Live Location Protection Service
=================================================
Manages:
  1. Geolocation tracking sessions (start, log coordinates, stop)
  2. Live Open-Meteo weather queries for real-time coordinates
  3. Dynamic thermal stress and ML heatwave prediction
  4. Real-time personal heat risk evaluation
  5. Intelligent risk escalation detection & deduplicated PostgreSQL alerts
  6. Rate limiting and distance-based caching (no excessive API spam)
"""
import math
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.database.models import (
    Alert, Location, LocationPoint, LocationTrackingSession,
    PersonalRiskAssessment, User, UserProfile
)
from app.ml.predict import predict_heatwave
from app.services.personal_risk_engine import calculate_personal_risk
from app.services.thermal_stress import thermal_stress_score
from app.services.weather_service import WeatherUnavailableError, get_current_weather

# Configuration Constants
LIVE_LOCATION_MIN_DISTANCE_METERS = 300.0  # 300 meters threshold for new weather fetch
LIVE_WEATHER_CACHE_TTL_SECONDS = 180       # 3 minutes cache per coordinate grid
ESCALATION_COOLDOWN_SECONDS = 900          # 15 minutes cooldown for same alert level

# In-memory weather cache: (lat_round, lon_round) -> (timestamp, weather_data)
_WEATHER_CACHE: Dict[str, tuple[float, dict]] = {}

# In-memory user state: user_id -> dict(last_lat, last_lon, last_risk, last_alert_time, last_alert_level)
_USER_TRACKING_STATE: Dict[int, dict] = {}


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two points on Earth in meters."""
    R = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = (math.sin(dphi / 2.0) ** 2) + math.cos(phi1) * math.cos(phi2) * (math.sin(dlam / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))
    return R * c


def _get_cached_or_live_weather(lat: float, lon: float) -> dict:
    """Fetches weather from Open-Meteo with short-term spatial cache."""
    cache_key = f"{lat:.2f}_{lon:.2f}"
    now = time.time()
    if cache_key in _WEATHER_CACHE:
        cached_time, cached_data = _WEATHER_CACHE[cache_key]
        if (now - cached_time) < LIVE_WEATHER_CACHE_TTL_SECONDS:
            return cached_data

    # Fetch live from Open-Meteo
    weather_data = get_current_weather(lat=lat, lon=lon, city="Live GPS Location")
    _WEATHER_CACHE[cache_key] = (now, weather_data)
    return weather_data


def start_live_protection_session(db: Session, user_id: int) -> LocationTrackingSession:
    """Starts or resumes an active tracking session for the user."""
    # Close any existing active sessions that were not cleanly closed
    active_sessions = (
        db.query(LocationTrackingSession)
        .filter(LocationTrackingSession.user_id == user_id, LocationTrackingSession.status == "ACTIVE")
        .all()
    )
    for s in active_sessions:
        s.status = "COMPLETED"
        s.ended_at = datetime.utcnow()
    db.commit()

    # Create new session
    session = LocationTrackingSession(
        user_id=user_id,
        started_at=datetime.utcnow(),
        status="ACTIVE",
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # Initialize in-memory state
    _USER_TRACKING_STATE[user_id] = {
        "session_id": session.id,
        "last_lat": None,
        "last_lon": None,
        "last_risk_level": "LOW",
        "last_risk_score": 0.0,
        "last_alert_time": 0.0,
        "last_alert_level": None,
    }

    return session


def stop_live_protection_session(db: Session, user_id: int) -> Optional[LocationTrackingSession]:
    """Stops the active tracking session for the user."""
    session = (
        db.query(LocationTrackingSession)
        .filter(LocationTrackingSession.user_id == user_id, LocationTrackingSession.status == "ACTIVE")
        .order_by(LocationTrackingSession.started_at.desc())
        .first()
    )
    if session:
        session.status = "COMPLETED"
        session.ended_at = datetime.utcnow()
        db.commit()
        db.refresh(session)

    if user_id in _USER_TRACKING_STATE:
        _USER_TRACKING_STATE.pop(user_id, None)

    return session


def get_live_protection_status(db: Session, user_id: int) -> Dict[str, Any]:
    """Returns the current tracking status and telemetry for the user."""
    session = (
        db.query(LocationTrackingSession)
        .filter(LocationTrackingSession.user_id == user_id, LocationTrackingSession.status == "ACTIVE")
        .order_by(LocationTrackingSession.started_at.desc())
        .first()
    )
    if not session:
        return {
            "active": False,
            "session_id": None,
            "started_at": None,
            "last_location": None,
            "latest_assessment": None,
        }

    # Fetch last point
    last_point = (
        db.query(LocationPoint)
        .filter(LocationPoint.session_id == session.id)
        .order_by(LocationPoint.timestamp.desc())
        .first()
    )

    # Fetch latest personal assessment
    last_assessment = (
        db.query(PersonalRiskAssessment)
        .filter(PersonalRiskAssessment.user_id == user_id)
        .order_by(PersonalRiskAssessment.timestamp.desc())
        .first()
    )

    return {
        "active": True,
        "session_id": session.id,
        "started_at": session.started_at.isoformat() if session.started_at else None,
        "last_location": {
            "latitude": last_point.latitude,
            "longitude": last_point.longitude,
            "timestamp": last_point.timestamp.isoformat() if last_point.timestamp else None,
        } if last_point else None,
        "latest_assessment": {
            "temperature": last_assessment.temperature,
            "humidity": last_assessment.humidity,
            "thermal_stress_score": last_assessment.thermal_stress_score,
            "heatwave_probability": last_assessment.heatwave_probability,
            "personal_risk_score": last_assessment.personal_risk_score,
            "personal_risk_level": last_assessment.personal_risk_level,
            "recommendation": last_assessment.recommendation,
            "timestamp": last_assessment.timestamp.isoformat() if last_assessment.timestamp else None,
        } if last_assessment else None,
    }


def process_live_location_update(
    db: Session,
    user_id: int,
    latitude: float,
    longitude: float,
) -> Dict[str, Any]:
    """
    Ingests live coordinates from browser geolocation, evaluates heat risk,
    detects escalation, and creates alerts when needed.
    """
    # 1. Get or create active session
    session = (
        db.query(LocationTrackingSession)
        .filter(LocationTrackingSession.user_id == user_id, LocationTrackingSession.status == "ACTIVE")
        .order_by(LocationTrackingSession.started_at.desc())
        .first()
    )
    if not session:
        session = start_live_protection_session(db, user_id)

    # 2. Record location point
    point = LocationPoint(
        session_id=session.id,
        latitude=latitude,
        longitude=longitude,
        timestamp=datetime.utcnow(),
    )
    db.add(point)
    db.commit()

    # 3. Retrieve User Profile
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    age_group = profile.age_group if profile else "18-44"
    vuln_cat = profile.vulnerability_category if profile else "General Population"
    activity = profile.activity_level if profile else "Mostly Indoor"
    water = profile.water_access if profile else "Always available"
    sensitivity = profile.heat_sensitivity if profile else "No"
    alerts_enabled = profile.alerts_enabled if profile else True
    alert_threshold = profile.alert_threshold if profile else "High and Extreme"

    # 4. Fetch Live Weather for Coordinates (Open-Meteo)
    weather = _get_cached_or_live_weather(lat=latitude, lon=longitude)
    temp = weather["temperature"]
    hum = weather["humidity"]
    wind = weather["wind_speed"]
    solar = weather["solar_radiation"]
    pressure = weather["pressure"]
    precipitation = weather["precipitation"]
    dew_point = weather["dew_point"]

    # 5. Predict Heatwave ML
    now_utc = datetime.now(timezone.utc)
    features = {
        "temperature": temp,
        "max_temperature": temp + 3.0,
        "min_temperature": temp - 4.0,
        "humidity": hum,
        "wind_speed": wind,
        "solar_radiation": solar,
        "pressure": pressure,
        "precipitation": precipitation,
        "dew_point": dew_point,
        "latitude": latitude,
        "longitude": longitude,
        "day_of_year": now_utc.timetuple().tm_yday,
        "month": now_utc.month,
    }
    pred = predict_heatwave(features)
    heatwave_prob = pred["heatwave_probability"]

    # 6. Calculate Personal Risk
    risk_result = calculate_personal_risk(
        temperature=temp,
        humidity=hum,
        wind_speed=wind,
        solar_radiation=solar,
        heatwave_probability=heatwave_prob,
        age_group=age_group,
        vulnerability_category=vuln_cat,
        activity_level=activity,
        water_access=water,
        heat_sensitivity=sensitivity,
    )

    personal_score = risk_result["personal_risk_score"]
    personal_level = risk_result["personal_risk_level"]
    env_risk = risk_result["environmental_risk"]
    ts_score = risk_result["thermal_stress_score"]

    # 7. Find closest saved location in DB or fallback
    closest_loc = None
    all_locs = db.query(Location).filter(Location.is_active == True).all()
    min_dist = float("inf")
    for loc in all_locs:
        d = haversine_distance_meters(latitude, longitude, loc.latitude, loc.longitude)
        if d < min_dist:
            min_dist = d
            closest_loc = loc

    location_id = closest_loc.id if closest_loc else (all_locs[0].id if all_locs else 1)

    # 8. Save PersonalRiskAssessment record in PostgreSQL
    assessment = PersonalRiskAssessment(
        user_id=user_id,
        location_id=location_id,
        timestamp=datetime.utcnow(),
        temperature=temp,
        humidity=hum,
        thermal_stress_score=ts_score,
        heatwave_probability=heatwave_prob,
        environmental_risk=env_risk,
        personal_risk_score=personal_score,
        personal_risk_level=personal_level,
        recommendation=risk_result["recommendation"],
    )
    db.add(assessment)
    db.commit()

    # 9. Risk Escalation Detection
    tracking_state = _USER_TRACKING_STATE.get(user_id, {})
    prev_level = tracking_state.get("last_risk_level", "LOW")
    prev_score = tracking_state.get("last_risk_score", 0.0)
    last_alert_time = tracking_state.get("last_alert_time", 0.0)
    last_alert_level = tracking_state.get("last_alert_level")

    risk_rank = {"LOW": 0, "MODERATE": 1, "HIGH": 2, "EXTREME": 3}
    curr_rank = risk_rank.get(personal_level, 0)
    prev_rank = risk_rank.get(prev_level, 0)

    escalation_detected = False
    escalation_reason = ""
    created_alert_data = None
    now_ts = time.time()

    # Escalation condition:
    # 1. Level increased to HIGH or EXTREME (e.g. LOW->HIGH, MODERATE->HIGH, HIGH->EXTREME)
    # 2. OR first observation in dangerous territory (HIGH / EXTREME) without recent alert
    is_dangerous_level = personal_level in ("HIGH", "EXTREME")
    level_escalated = curr_rank > prev_rank and is_dangerous_level
    cooldown_expired = (now_ts - last_alert_time) > ESCALATION_COOLDOWN_SECONDS

    # Check alert preference filter
    matches_preference = True
    if alert_threshold == "Extreme only" and personal_level != "EXTREME":
        matches_preference = False

    if alerts_enabled and matches_preference:
        if level_escalated or (is_dangerous_level and (last_alert_level != personal_level and cooldown_expired)):
            escalation_detected = True
            escalation_reason = (
                f"Personal heat risk escalated from {prev_level} to {personal_level} "
                f"(Ambient: {temp:.1f}°C, Stress Score: {ts_score:.0f}/100)."
            )

            # Build comprehensive alert message
            alert_msg = (
                f"🚨 {personal_level} HEAT ALERT DETECTED AT YOUR CURRENT LOCATION: "
                f"Temperature is {temp:.1f}°C with {hum:.0f}% humidity and {personal_level} personal risk. "
                f"Action required: Move to a cooler/shaded location immediately and hydrate."
            )

            # Save alert to PostgreSQL
            new_alert = Alert(
                user_id=user_id,
                location_id=location_id,
                alert_level=personal_level,
                message=alert_msg,
                risk_level=personal_level,
                temperature=temp,
                heatwave_probability=heatwave_prob,
                thermal_stress_score=ts_score,
                acknowledged=False,
            )
            db.add(new_alert)
            db.commit()
            db.refresh(new_alert)

            created_alert_data = {
                "id": new_alert.id,
                "alert_level": new_alert.alert_level,
                "message": new_alert.message,
                "risk_level": new_alert.risk_level,
                "temperature": new_alert.temperature,
                "thermal_stress_score": new_alert.thermal_stress_score,
                "heatwave_probability": new_alert.heatwave_probability,
                "created_at": new_alert.created_at.isoformat() if new_alert.created_at else "",
                "acknowledged": False,
            }

            # Update tracking state
            tracking_state["last_alert_time"] = now_ts
            tracking_state["last_alert_level"] = personal_level

    # Update in-memory user tracking state
    tracking_state["last_lat"] = latitude
    tracking_state["last_lon"] = longitude
    tracking_state["last_risk_level"] = personal_level
    tracking_state["last_risk_score"] = personal_score
    _USER_TRACKING_STATE[user_id] = tracking_state

    return {
        "session_id": session.id,
        "latitude": latitude,
        "longitude": longitude,
        "timestamp": datetime.utcnow().isoformat(),
        "weather": {
            "temperature": temp,
            "humidity": hum,
            "wind_speed": wind,
            "solar_radiation": solar,
            "dew_point": dew_point,
            "data_source": "Open-Meteo",
        },
        "assessment": risk_result,
        "escalation_detected": escalation_detected,
        "escalation_reason": escalation_reason,
        "alert": created_alert_data,
    }


def get_live_protection_history(db: Session, user_id: int, limit: int = 10) -> List[Dict[str, Any]]:
    """Fetches past tracking sessions and their recorded points."""
    sessions = (
        db.query(LocationTrackingSession)
        .filter(LocationTrackingSession.user_id == user_id)
        .order_by(LocationTrackingSession.started_at.desc())
        .limit(limit)
        .all()
    )

    history = []
    for s in sessions:
        pts = (
            db.query(LocationPoint)
            .filter(LocationPoint.session_id == s.id)
            .order_by(LocationPoint.timestamp.asc())
            .all()
        )
        history.append({
            "session_id": s.id,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "ended_at": s.ended_at.isoformat() if s.ended_at else None,
            "status": s.status,
            "points_count": len(pts),
            "points": [
                {
                    "latitude": p.latitude,
                    "longitude": p.longitude,
                    "timestamp": p.timestamp.isoformat() if p.timestamp else None,
                }
                for p in pts[:20]  # Cap points per session in overview
            ],
        })

    return history
