"""
HeatShield AI – Personal Health Profile & Risk Assessment Router
================================================================
Endpoints:
  GET  /api/profile
  PUT  /api/profile
  POST /api/personal-risk/assess
  POST /api/personal-risk/can-go-out
  POST /api/personal-risk/precautions
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database.models import (
    Location, PersonalRiskAssessment, User, UserHealthSensitivity, UserProfile
)
from app.database.session import get_db
from app.ml.predict import predict_heatwave
from app.schemas.personal_risk import (
    HealthSensitivityResponse,
    HealthSensitivityUpdateRequest,
    PersonalRiskAssessRequest,
    PersonalRiskResponse,
    UserProfileResponse,
    UserProfileUpdate,
)
from app.services.personal_risk_engine import MEDICAL_DISCLAIMER, calculate_personal_risk
from app.services.weather_service import WeatherUnavailableError, get_current_weather
from app.utils.security import decode_access_token

router = APIRouter(prefix="/api", tags=["personal-risk"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    try:
        user_id = int(sub)
    except (ValueError, TypeError):
        user_id = sub
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def get_optional_user(token: Optional[str] = Depends(oauth2_scheme_optional), db: Session = Depends(get_db)) -> Optional[User]:
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload:
        return None
    sub = payload.get("sub")
    if sub is None:
        return None
    try:
        user_id = int(sub)
    except (ValueError, TypeError):
        user_id = sub
    return db.query(User).filter(User.id == user_id).first()


def _get_or_create_profile(user: User, db: Session) -> UserProfile:
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if not profile:
        default_loc = db.query(Location).first()
        profile = UserProfile(
            user_id=user.id,
            age_group="18-44",
            vulnerability_category="General Population",
            activity_level="Mostly Indoor",
            water_access="Always available",
            heat_sensitivity="No",
            default_location_id=default_loc.id if default_loc else None,
            alert_threshold="High and Extreme",
            alerts_enabled=True,
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


def _format_profile_response(user: User, profile: UserProfile) -> dict:
    loc = profile.default_location
    loc_summary = None
    if loc:
        loc_summary = {
            "id": loc.id,
            "name": loc.name,
            "city": loc.city,
            "state": loc.state,
            "country": loc.country,
            "latitude": loc.latitude,
            "longitude": loc.longitude,
        }

    return {
        "id": profile.id,
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "age_group": profile.age_group,
        "vulnerability_category": profile.vulnerability_category,
        "activity_level": profile.activity_level,
        "water_access": profile.water_access,
        "heat_sensitivity": profile.heat_sensitivity,
        "default_location_id": profile.default_location_id,
        "default_location": loc_summary,
        "alert_threshold": profile.alert_threshold,
        "alerts_enabled": profile.alerts_enabled,
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
        "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
    }


# ── Profile Endpoints ─────────────────────────────────────────────────────────

@router.get("/profile", response_model=UserProfileResponse)
def get_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve the authenticated user's Heat-Health Profile."""
    profile = _get_or_create_profile(current_user, db)
    return _format_profile_response(current_user, profile)


@router.put("/profile", response_model=UserProfileResponse)
def update_user_profile(
    req: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update user's Heat-Health Profile."""
    profile = _get_or_create_profile(current_user, db)

    if req.age_group is not None:
        profile.age_group = req.age_group
    if req.vulnerability_category is not None:
        profile.vulnerability_category = req.vulnerability_category
    if req.activity_level is not None:
        profile.activity_level = req.activity_level
    if req.water_access is not None:
        profile.water_access = req.water_access
    if req.heat_sensitivity is not None:
        profile.heat_sensitivity = req.heat_sensitivity
    if req.default_location_id is not None:
        profile.default_location_id = req.default_location_id
    if req.alert_threshold is not None:
        profile.alert_threshold = req.alert_threshold
    if req.alerts_enabled is not None:
        profile.alerts_enabled = req.alerts_enabled

    profile.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(profile)
    return _format_profile_response(current_user, profile)


# ── Feature 11: Health & Heat Sensitivity Endpoints ───────────────────────────

@router.get("/profile/health-sensitivity", response_model=HealthSensitivityResponse)
def get_health_sensitivities(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve user's optional health & heat sensitivity conditions."""
    sens_records = (
        db.query(UserHealthSensitivity)
        .filter(UserHealthSensitivity.user_id == current_user.id)
        .order_by(UserHealthSensitivity.created_at.asc())
        .all()
    )
    sens_types = [r.sensitivity_type for r in sens_records]
    return {
        "user_id": current_user.id,
        "sensitivities": sens_types,
        "count": len(sens_types),
        "updated_at": sens_records[-1].created_at.isoformat() if sens_records else None,
        "disclaimer": (
            "This information is optional and is used only to provide more cautious "
            "heat-safety guidance based on your profile. HeatShield AI does not diagnose or treat medical conditions."
        ),
    }


@router.put("/profile/health-sensitivity", response_model=HealthSensitivityResponse)
def update_health_sensitivities(
    req: HealthSensitivityUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update user's health sensitivities. Overwrites existing selections cleanly."""
    # Delete existing
    db.query(UserHealthSensitivity).filter(UserHealthSensitivity.user_id == current_user.id).delete()

    # Insert new selections
    valid_sens = [s.strip() for s in req.sensitivities if s and s.strip()]
    for s_type in valid_sens:
        db.add(UserHealthSensitivity(user_id=current_user.id, sensitivity_type=s_type))

    # Also sync profile.heat_sensitivity flag if any conditions present
    profile = _get_or_create_profile(current_user, db)
    if any(s not in ("None", "Prefer not to say") for s in valid_sens):
        profile.heat_sensitivity = "Yes"
    else:
        profile.heat_sensitivity = "No"

    profile.updated_at = datetime.utcnow()
    db.commit()

    return {
        "user_id": current_user.id,
        "sensitivities": valid_sens,
        "count": len(valid_sens),
        "updated_at": datetime.utcnow().isoformat(),
        "disclaimer": (
            "This information is optional and is used only to provide more cautious "
            "heat-safety guidance based on your profile. HeatShield AI does not diagnose or treat medical conditions."
        ),
    }


@router.delete("/profile/health-sensitivity")
def delete_health_sensitivities(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete all health & heat sensitivity information for the user."""
    db.query(UserHealthSensitivity).filter(UserHealthSensitivity.user_id == current_user.id).delete()
    profile = _get_or_create_profile(current_user, db)
    profile.heat_sensitivity = "No"
    profile.updated_at = datetime.utcnow()
    db.commit()
    return {
        "message": "Health sensitivity information cleared successfully.",
        "user_id": current_user.id,
    }


# ── Personal Risk Engine Endpoints ────────────────────────────────────────────

@router.post("/personal-risk/assess", response_model=PersonalRiskResponse)
def assess_personal_risk(
    req: PersonalRiskAssessRequest,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """
    Computes personalized heat-health risk dynamically using live Open-Meteo weather,
    thermal stress, heatwave ML predictions, user profile, and health sensitivities.
    """
    # 1. Determine profile factors (from DB or request override)
    user_profile = None
    saved_sensitivities: List[str] = []
    if current_user:
        user_profile = _get_or_create_profile(current_user, db)
        sens_records = (
            db.query(UserHealthSensitivity)
            .filter(UserHealthSensitivity.user_id == current_user.id)
            .all()
        )
        saved_sensitivities = [r.sensitivity_type for r in sens_records]

    age_group = req.age_group or (user_profile.age_group if user_profile else "18-44")
    vuln_cat = req.vulnerability_category or (user_profile.vulnerability_category if user_profile else "General Population")
    activity = req.activity_level or (user_profile.activity_level if user_profile else "Mostly Indoor")
    water = req.water_access or (user_profile.water_access if user_profile else "Always available")
    sensitivity = req.heat_sensitivity or (user_profile.heat_sensitivity if user_profile else "No")
    health_sens = req.health_sensitivities if req.health_sensitivities is not None else saved_sensitivities

    # 2. Determine Coordinates
    lat = req.latitude
    lon = req.longitude
    city = req.city or "Unknown Location"

    if (lat is None or lon is None) and user_profile and user_profile.default_location:
        lat = user_profile.default_location.latitude
        lon = user_profile.default_location.longitude
        city = user_profile.default_location.city or user_profile.default_location.name

    if lat is None or lon is None:
        lat, lon = 17.385, 78.486  # Hyderabad fallback coords
        city = "Hyderabad"

    # 3. Fetch Live Weather from Open-Meteo
    try:
        w = get_current_weather(lat=lat, lon=lon, city=city)
    except WeatherUnavailableError as e:
        raise HTTPException(status_code=503, detail="Live weather data is currently unavailable from Open-Meteo.")

    temp = req.temperature if req.temperature is not None else w["temperature"]
    hum = req.humidity if req.humidity is not None else w["humidity"]
    wind = req.wind_speed if req.wind_speed is not None else w["wind_speed"]
    solar = req.solar_radiation if req.solar_radiation is not None else w["solar_radiation"]

    # 4. Predict Heatwave ML Probability
    now_utc = datetime.now(timezone.utc)
    features = {
        "temperature": temp,
        "max_temperature": temp + 3.0,
        "min_temperature": temp - 4.0,
        "humidity": hum,
        "wind_speed": wind,
        "solar_radiation": solar,
        "pressure": w["pressure"],
        "precipitation": w["precipitation"],
        "dew_point": w["dew_point"],
        "latitude": lat,
        "longitude": lon,
        "day_of_year": now_utc.timetuple().tm_yday,
        "month": now_utc.month,
    }
    pred = predict_heatwave(features)
    heatwave_prob = pred["heatwave_probability"]

    # 5. Compute Personal Risk using dedicated engine
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
        health_sensitivities=health_sens,
    )

    # 6. Save Assessment in PostgreSQL if user is logged in
    if current_user:
        loc_id = user_profile.default_location_id if user_profile else None
        assessment = PersonalRiskAssessment(
            user_id=current_user.id,
            location_id=loc_id,
            timestamp=datetime.utcnow(),
            temperature=temp,
            humidity=hum,
            thermal_stress_score=risk_result["thermal_stress_score"],
            heatwave_probability=heatwave_prob,
            environmental_risk=risk_result["environmental_risk"],
            personal_risk_score=risk_result["personal_risk_score"],
            personal_risk_level=risk_result["personal_risk_level"],
            recommendation=risk_result["recommendation"],
        )
        db.add(assessment)
        db.commit()

    return {
        "environmental_risk": risk_result["environmental_risk"],
        "thermal_stress_score": risk_result["thermal_stress_score"],
        "thermal_stress_category": risk_result["thermal_stress_category"],
        "heat_index": risk_result["heat_index"],
        "heatwave_probability": heatwave_prob,
        "personal_risk_score": risk_result["personal_risk_score"],
        "personal_risk_level": risk_result["personal_risk_level"],
        "score_label": "HeatShield Personal Risk Score",
        "main_risk_factors": risk_result["main_risk_factors"],
        "can_go_outside": risk_result["can_go_outside"],
        "recommendation": risk_result["recommendation"],
        "precautions": risk_result["precautions"],
        "disclaimer": MEDICAL_DISCLAIMER,
        "profile_summary": risk_result["profile_summary"],
        "location_summary": {
            "city": city,
            "latitude": lat,
            "longitude": lon,
        },
        "weather_summary": {
            "temperature": temp,
            "humidity": hum,
            "wind_speed": wind,
            "solar_radiation": solar,
            "dew_point": w["dew_point"],
            "data_source": "Open-Meteo",
        },
    }


@router.post("/personal-risk/can-go-out")
def can_go_outside_now(
    req: PersonalRiskAssessRequest,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """
    Evaluates 'Can I Go Outside Now?' dynamically based on environmental conditions & profile.
    """
    res = assess_personal_risk(req=req, current_user=current_user, db=db)
    return {
        "can_go_outside": res["can_go_outside"],
        "personal_risk_score": res["personal_risk_score"],
        "personal_risk_level": res["personal_risk_level"],
        "environmental_risk": res["environmental_risk"],
        "main_risk_factors": res["main_risk_factors"],
        "recommendation": res["recommendation"],
        "weather_summary": res["weather_summary"],
        "disclaimer": MEDICAL_DISCLAIMER,
    }


@router.post("/personal-risk/precautions")
def get_personal_precautions(
    req: PersonalRiskAssessRequest,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """
    Returns personalized heat-safety precautions ('I MUST GO OUT').
    """
    res = assess_personal_risk(req=req, current_user=current_user, db=db)
    return {
        "personal_risk_score": res["personal_risk_score"],
        "personal_risk_level": res["personal_risk_level"],
        "precautions": res["precautions"],
        "recommendation": res["recommendation"],
        "main_risk_factors": res["main_risk_factors"],
        "disclaimer": MEDICAL_DISCLAIMER,
    }
