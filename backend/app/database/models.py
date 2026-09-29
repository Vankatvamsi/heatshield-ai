"""
HeatShield AI – SQLAlchemy Database Models
All ORM table definitions for PostgreSQL.

Tables:
  users, locations, weather_data, predictions, thermal_stress,
  uhi_data, vulnerable_profiles, alerts, historical_records,
  user_profiles, personal_risk_assessments,
  location_tracking_sessions, location_points,
  admin_registration_requests
"""
import secrets
from datetime import datetime, timedelta

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Integer, String, Text
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(200), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    # Role: user | admin | super_admin
    role = Column(String(20), default="user", nullable=False)
    # Status: pending | active | rejected | suspended
    status = Column(String(20), default="active", nullable=False)
    default_location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    alerts = relationship("Alert", back_populates="user")
    vulnerable_profile = relationship("VulnerableProfile", back_populates="user", uselist=False)
    profile = relationship("UserProfile", back_populates="user", uselist=False)
    personal_risk_assessments = relationship("PersonalRiskAssessment", back_populates="user")
    tracking_sessions = relationship("LocationTrackingSession", back_populates="user")
    health_sensitivities = relationship("UserHealthSensitivity", back_populates="user", cascade="all, delete-orphan")
    journeys = relationship("Journey", back_populates="user", cascade="all, delete-orphan")
    journey_feedback = relationship("JourneyHealthFeedback", back_populates="user", cascade="all, delete-orphan")

    @property
    def is_active(self):
        return self.status == "active"

    @property
    def is_admin(self):
        return self.role in ("admin", "super_admin") and self.status == "active"

    @property
    def is_super_admin(self):
        return self.role == "super_admin" and self.status == "active"


class AdminRegistrationRequest(Base):
    """Tracks admin account requests pending super-admin approval."""
    __tablename__ = "admin_registration_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    # Status: pending | approved | rejected
    status = Column(String(20), default="pending", nullable=False)
    # Secure random single-use token for email approval link
    approval_token = Column(String(128), unique=True, nullable=False)
    token_used = Column(Boolean, default=False)
    token_expires_at = Column(DateTime, nullable=False)
    # Optional note from the applicant
    applicant_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    user = relationship("User")

    @staticmethod
    def generate_token() -> str:
        return secrets.token_urlsafe(64)

    @staticmethod
    def token_expiry_hours(hours: int = 72) -> datetime:
        return datetime.utcnow() + timedelta(hours=hours)

    def is_valid_token(self) -> bool:
        return (
            not self.token_used
            and self.token_expires_at > datetime.utcnow()
            and self.status == "pending"
        )


class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    city = Column(String(100))
    state = Column(String(100))
    country = Column(String(100), default="India")
    timezone = Column(String(50))
    is_active = Column(Boolean, default=True)

    weather_data = relationship("WeatherData", back_populates="location")
    predictions = relationship("Prediction", back_populates="location")
    thermal_stress_records = relationship("ThermalStressRecord", back_populates="location")
    uhi_data = relationship("UHIData", back_populates="location")
    alerts = relationship("Alert", back_populates="location")
    historical_records = relationship("HistoricalRecord", back_populates="location")


class WeatherData(Base):
    __tablename__ = "weather_data"

    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    temperature = Column(Float)
    humidity = Column(Float)
    wind_speed = Column(Float)
    pressure = Column(Float)
    solar_radiation = Column(Float)
    precipitation = Column(Float)
    dew_point = Column(Float)
    apparent_temperature = Column(Float)
    data_source = Column(String(50), default="Open-Meteo")
    created_at = Column(DateTime, default=datetime.utcnow)

    location = relationship("Location", back_populates="weather_data")


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    heatwave_probability = Column(Float)
    risk_level = Column(String(20))     # LOW | MODERATE | HIGH | EXTREME
    model_version = Column(String(50), default="1.0.0")
    model_source = Column(String(50), default="ml_model")   # ml_model | rule_based_fallback
    created_at = Column(DateTime, default=datetime.utcnow)

    location = relationship("Location", back_populates="predictions")


class ThermalStressRecord(Base):
    __tablename__ = "thermal_stress"

    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    temperature = Column(Float)
    humidity = Column(Float)
    heat_index = Column(Float)
    thermal_stress_score = Column(Float)
    thermal_stress_level = Column(String(20))   # LOW|MODERATE|ELEVATED|HIGH|EXTREME
    created_at = Column(DateTime, default=datetime.utcnow)

    location = relationship("Location", back_populates="thermal_stress_records")


class UHIData(Base):
    __tablename__ = "uhi_data"

    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    urban_temperature = Column(Float)
    reference_temperature = Column(Float)
    uhi_intensity = Column(Float)
    uhi_level = Column(String(20))   # LOW | MODERATE | HIGH | EXTREME
    land_cover = Column(String(50))
    data_note = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    location = relationship("Location", back_populates="uhi_data")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    alert_level = Column(String(20), nullable=False)    # INFO|WARNING|HIGH|EXTREME
    message = Column(Text, nullable=False)
    risk_level = Column(String(20))
    temperature = Column(Float)
    heatwave_probability = Column(Float)
    thermal_stress_score = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    acknowledged = Column(Boolean, default=False)

    user = relationship("User", back_populates="alerts")
    location = relationship("Location", back_populates="alerts")


class VulnerableProfile(Base):
    __tablename__ = "vulnerable_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    # general | children | elderly | outdoor_worker | athlete
    category = Column(String(50), default="general")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="vulnerable_profile")


class HistoricalRecord(Base):
    __tablename__ = "historical_records"

    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    date = Column(String(10), nullable=False)   # ISO date YYYY-MM-DD
    max_temperature = Column(Float)
    min_temperature = Column(Float)
    humidity = Column(Float)
    heatwave_label = Column(Integer, default=0)  # 0 or 1

    location = relationship("Location", back_populates="historical_records")


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    age_group = Column(String(50), default="18-44")
    vulnerability_category = Column(String(100), default="General Population")
    activity_level = Column(String(50), default="Mostly Indoor")
    water_access = Column(String(50), default="Always available")
    heat_sensitivity = Column(String(50), default="No")
    default_location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    alert_threshold = Column(String(50), default="High and Extreme")
    alerts_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="profile")
    default_location = relationship("Location")


class UserHealthSensitivity(Base):
    """
    Feature 11: Normalized storage of user health sensitivities and heat condition flags.
    Optional and non-diagnostic for safety personalization.
    """
    __tablename__ = "user_health_sensitivities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    sensitivity_type = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="health_sensitivities")


class PersonalRiskAssessment(Base):
    __tablename__ = "personal_risk_assessments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    temperature = Column(Float)
    humidity = Column(Float)
    thermal_stress_score = Column(Float)
    heatwave_probability = Column(Float)
    environmental_risk = Column(String(20))     # LOW | MODERATE | HIGH | EXTREME
    personal_risk_score = Column(Float)         # 0 - 100
    personal_risk_level = Column(String(20))    # LOW | MODERATE | HIGH | EXTREME
    recommendation = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="personal_risk_assessments")
    location = relationship("Location")


class LocationTrackingSession(Base):
    __tablename__ = "location_tracking_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    status = Column(String(20), default="ACTIVE")   # ACTIVE | COMPLETED

    user = relationship("User", back_populates="tracking_sessions")
    points = relationship("LocationPoint", back_populates="session", cascade="all, delete-orphan")


class LocationPoint(Base):
    __tablename__ = "location_points"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("location_tracking_sessions.id"), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

    session = relationship("LocationTrackingSession", back_populates="points")


class Journey(Base):
    """
    Feature 10: Tracked heat-safe road journeys.
    """
    __tablename__ = "journeys"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    start_location = Column(String(200), nullable=False)
    start_latitude = Column(Float, nullable=False)
    start_longitude = Column(Float, nullable=False)
    destination = Column(String(200), nullable=False)
    destination_latitude = Column(Float, nullable=False)
    destination_longitude = Column(Float, nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    status = Column(String(20), default="PLANNED")   # PLANNED | ACTIVE | COMPLETED | CANCELLED
    recommended_route = Column(Text, nullable=True)  # JSON representation of selected route summary
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="journeys")
    segments = relationship("RouteRiskSegment", back_populates="journey", cascade="all, delete-orphan")
    feedback = relationship("JourneyHealthFeedback", back_populates="journey", cascade="all, delete-orphan")


class RouteRiskSegment(Base):
    """
    Feature 10: Evaluated heat-risk segments along a road route.
    """
    __tablename__ = "route_risk_segments"

    id = Column(Integer, primary_key=True, index=True)
    journey_id = Column(Integer, ForeignKey("journeys.id"), nullable=False, index=True)
    segment_index = Column(Integer, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    temperature = Column(Float, nullable=False)
    humidity = Column(Float, nullable=False)
    thermal_stress_score = Column(Float, nullable=False)
    heatwave_probability = Column(Float, nullable=False)
    risk_score = Column(Float, nullable=False)
    risk_level = Column(String(20), nullable=False)    # LOW | MODERATE | HIGH | EXTREME
    estimated_time = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    journey = relationship("Journey", back_populates="segments")


class JourneyHealthFeedback(Base):
    """
    Feature 10: Destination Health Check user feedback.
    Values: FINE | UNCOMFORTABLE | VERY_HOT | UNWELL
    """
    __tablename__ = "journey_health_feedback"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    journey_id = Column(Integer, ForeignKey("journeys.id"), nullable=False, index=True)
    feedback_level = Column(String(30), nullable=False)   # FINE | UNCOMFORTABLE | VERY_HOT | UNWELL
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="journey_feedback")
    journey = relationship("Journey", back_populates="feedback")


class SOSEvent(Base):
    """
    Tracks HeatSafe SOS emergency events.
    """
    __tablename__ = "heat_sos_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    address = Column(String(255), nullable=True)
    temperature = Column(Float, nullable=True)
    humidity = Column(Float, nullable=True)
    wind_speed = Column(Float, nullable=True)
    solar_radiation = Column(Float, nullable=True)
    heatwave_probability = Column(Float, nullable=True)
    heatwave_risk_level = Column(String(50), nullable=True)
    thermal_stress = Column(Float, nullable=True)
    personal_risk_score = Column(Float, nullable=True)
    vulnerability_category = Column(String(100), nullable=True)
    nearest_facility_id = Column(String(100), nullable=True)
    nearest_facility_name = Column(String(255), nullable=True)
    nearest_facility_type = Column(String(100), nullable=True)
    nearest_facility_distance_km = Column(Float, nullable=True)
    
    hospital_notification_status = Column(String(50), default="NOT_SENT")
    emergency_contact_phone = Column(String(50), nullable=True)
    emergency_contact_notification_status = Column(String(50), default="NOT_SENT")
    sms_timestamp = Column(DateTime, nullable=True)
    
    status = Column(String(20), default="ACTIVE")  # ACTIVE | RESOLVED | CANCELLED
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    user = relationship("User")

    @property
    def hospital(self):
        if self.nearest_facility_name:
            return {
                "name": self.nearest_facility_name,
                "distance_km": self.nearest_facility_distance_km,
                "notification_status": self.hospital_notification_status
            }
        return None

    @property
    def emergency_contact(self):
        if self.emergency_contact_phone:
            return {
                "phone": self.emergency_contact_phone,
                "notification_status": self.emergency_contact_notification_status
            }
        return None
