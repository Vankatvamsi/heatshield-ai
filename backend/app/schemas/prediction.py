from typing import Optional
from pydantic import BaseModel


class PredictionRequest(BaseModel):
    city: str = "Hyderabad"
    latitude: float = 17.385
    longitude: float = 78.486
    temperature: Optional[float] = None
    max_temperature: Optional[float] = None
    min_temperature: Optional[float] = None
    humidity: Optional[float] = None
    wind_speed: Optional[float] = None
    pressure: Optional[float] = None
    solar_radiation: Optional[float] = None
    precipitation: Optional[float] = None
    dew_point: Optional[float] = None


class HeatwavePredictionResponse(BaseModel):
    heatwave_probability: float
    classification: str
    risk_level: str
    heat_index: float
    thermal_stress_score: float
    thermal_stress_category: str
    explanation: list[str]
    model_source: str
    note: str


class ThermalStressRequest(BaseModel):
    temperature: float
    humidity: float
    wind_speed: float = 0.0
    solar_radiation: float = 500.0


class ThermalStressResponse(BaseModel):
    temperature: float
    humidity: float
    heat_index: float
    stress_score: float
    category: str
    explanation: str


class ForecastItem(BaseModel):
    horizon_hours: int
    timestamp: str
    temperature: float
    humidity: float
    wind_speed: float
    pressure: float
    heatwave_probability: float
    thermal_stress_score: float
    risk_level: str
    source: str


class AlertResponse(BaseModel):
    id: int
    location_id: int
    location_name: str
    alert_level: str
    message: str
    temperature: Optional[float]
    heatwave_probability: Optional[float]
    thermal_stress_score: Optional[float]
    created_at: str
    acknowledged: bool

    class Config:
        from_attributes = True


class VulnerableRequest(BaseModel):
    city: str = "Hyderabad"
    latitude: float = 17.385
    longitude: float = 78.486
    category: str = "general"


class LocationResponse(BaseModel):
    id: int
    name: str
    latitude: float
    longitude: float
    city: str
    state: str
    country: str

    class Config:
        from_attributes = True
