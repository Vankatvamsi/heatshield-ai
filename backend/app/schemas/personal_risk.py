from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class UserProfileUpdate(BaseModel):
    age_group: Optional[str] = Field(None, json_schema_extra={"example": "18-44"})
    vulnerability_category: Optional[str] = Field(None, json_schema_extra={"example": "Outdoor Worker"})
    activity_level: Optional[str] = Field(None, json_schema_extra={"example": "Heavy Physical Activity"})
    water_access: Optional[str] = Field(None, json_schema_extra={"example": "Always available"})
    heat_sensitivity: Optional[str] = Field(None, json_schema_extra={"example": "No"})
    default_location_id: Optional[int] = Field(None, json_schema_extra={"example": 1})
    alert_threshold: Optional[str] = Field(None, json_schema_extra={"example": "High and Extreme"})
    alerts_enabled: Optional[bool] = Field(None, json_schema_extra={"example": True})


class LocationSummary(BaseModel):
    id: int
    name: str
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = "India"
    latitude: float
    longitude: float

    model_config = {"from_attributes": True}


class UserProfileResponse(BaseModel):
    id: int
    user_id: int
    name: str
    email: str
    age_group: str
    vulnerability_category: str
    activity_level: str
    water_access: str
    heat_sensitivity: str
    default_location_id: Optional[int] = None
    default_location: Optional[LocationSummary] = None
    alert_threshold: str
    alerts_enabled: bool
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class HealthSensitivityUpdateRequest(BaseModel):
    sensitivities: List[str] = Field(default_factory=list, json_schema_extra={"example": ["Migraine / heat-triggered headaches", "Heart condition"]})


class HealthSensitivityResponse(BaseModel):
    user_id: int
    sensitivities: List[str]
    count: int
    updated_at: Optional[str] = None
    disclaimer: str = (
        "This information is optional and is used only to provide more cautious "
        "heat-safety guidance based on your profile. HeatShield AI does not diagnose or treat medical conditions."
    )


class PersonalRiskAssessRequest(BaseModel):
    city: Optional[str] = "Hyderabad"
    latitude: Optional[float] = 17.385
    longitude: Optional[float] = 78.486
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    wind_speed: Optional[float] = None
    solar_radiation: Optional[float] = None
    # Optional profile overrides for what-if simulations
    age_group: Optional[str] = None
    vulnerability_category: Optional[str] = None
    activity_level: Optional[str] = None
    water_access: Optional[str] = None
    heat_sensitivity: Optional[str] = None
    health_sensitivities: Optional[List[str]] = None


class CanGoOutDecision(BaseModel):
    code: str
    badge: str
    title: str
    message: str


class PrecautionItem(BaseModel):
    category: str
    title: str
    detail: str


class PersonalRiskResponse(BaseModel):
    environmental_risk: str
    thermal_stress_score: float
    thermal_stress_category: str
    heat_index: float
    heatwave_probability: float
    personal_risk_score: float
    personal_risk_level: str
    score_label: str = "HeatShield Personal Risk Score"
    main_risk_factors: List[str]
    can_go_outside: CanGoOutDecision
    recommendation: str
    precautions: List[PrecautionItem]
    disclaimer: str
    profile_summary: Dict[str, Any]
    location_summary: Optional[Dict[str, Any]] = None
    weather_summary: Optional[Dict[str, Any]] = None


class LiveLocationUpdateRequest(BaseModel):
    latitude: float
    longitude: float


class LiveProtectionStatusResponse(BaseModel):
    active: bool
    session_id: Optional[int] = None
    started_at: Optional[str] = None
    last_location: Optional[Dict[str, Any]] = None
    latest_assessment: Optional[Dict[str, Any]] = None
