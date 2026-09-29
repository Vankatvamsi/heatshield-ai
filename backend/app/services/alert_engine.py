"""
HeatShield AI – Alert Engine
Evaluates current conditions and creates/deduplicates alerts.
"""
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.database.models import Alert, Location
from app.utils.config import get_settings

settings = get_settings()

ALERT_MESSAGES = {
    "INFO": (
        "Warm weather conditions are expected. Stay hydrated and avoid prolonged sun exposure."
    ),
    "WARNING": (
        "Elevated heat conditions forecast. Limit outdoor activity during peak hours (12–4 PM)."
    ),
    "HIGH": (
        "High heat alert: Dangerous temperatures expected. Avoid prolonged outdoor exposure, "
        "drink water regularly, and check on vulnerable individuals."
    ),
    "EXTREME": (
        "EXTREME HEAT ALERT: Life-threatening heat conditions forecast. Seek air-conditioned "
        "shelter immediately. Avoid all outdoor activity during peak hours. Stay hydrated."
    ),
}

DEDUP_WINDOW_HOURS = 6  # Don't create the same alert twice within this window


def evaluate_and_create_alert(
    db: Session,
    location: Location,
    heatwave_probability: float,
    thermal_stress_score: float,
    temperature: float,
    risk_level: str,
    user_id: Optional[int] = None,
) -> Optional[Alert]:
    """
    Evaluate conditions and create an alert if thresholds are met.
    Returns the created Alert or None.
    """
    thresholds = settings.load_thresholds()
    at = thresholds["alert_thresholds"]

    # Determine alert level
    if heatwave_probability >= at["extreme_probability"] or risk_level == "EXTREME":
        alert_level = "EXTREME"
    elif heatwave_probability >= at["high_probability"] or risk_level == "HIGH":
        alert_level = "HIGH"
    elif heatwave_probability >= at["warning_probability"] or risk_level == "MODERATE":
        alert_level = "WARNING"
    elif heatwave_probability >= at["info_probability"]:
        alert_level = "INFO"
    else:
        return None  # No alert needed

    # Deduplication: check if a similar alert was recently created
    cutoff = datetime.utcnow() - timedelta(hours=DEDUP_WINDOW_HOURS)
    existing = (
        db.query(Alert)
        .filter(
            Alert.location_id == location.id,
            Alert.alert_level == alert_level,
            Alert.created_at >= cutoff,
        )
        .first()
    )
    if existing:
        return existing  # Return existing alert, do not duplicate

    # Create new alert
    message = ALERT_MESSAGES[alert_level]
    alert = Alert(
        user_id=user_id,
        location_id=location.id,
        alert_level=alert_level,
        message=message,
        risk_level=risk_level,
        temperature=temperature,
        heatwave_probability=heatwave_probability,
        thermal_stress_score=thermal_stress_score,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


def get_alerts(db: Session, location_id: Optional[int] = None, limit: int = 50) -> list[Alert]:
    q = db.query(Alert)
    if location_id is not None:
        q = q.filter(Alert.location_id == location_id)
    return q.order_by(Alert.created_at.desc()).limit(limit).all()


def acknowledge_alert(db: Session, alert_id: int) -> Optional[Alert]:
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if alert:
        alert.acknowledged = True
        db.commit()
        db.refresh(alert)
    return alert
