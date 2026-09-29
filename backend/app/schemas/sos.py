from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class SOSCreate(BaseModel):
    latitude: float
    longitude: float
    address: Optional[str] = None
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    wind_speed: Optional[float] = None
    solar_radiation: Optional[float] = None
    heatwave_probability: Optional[float] = None
    heatwave_risk_level: Optional[str] = None
    thermal_stress: Optional[float] = None
    personal_risk_score: Optional[float] = None
    vulnerability_category: Optional[str] = None

class SOSHospitalInfo(BaseModel):
    name: Optional[str]
    distance_km: Optional[float]
    notification_status: Optional[str]

class SOSEmergencyContactInfo(BaseModel):
    phone: Optional[str]
    notification_status: Optional[str]

class SOSResponse(BaseModel):
    id: int
    user_id: Optional[int]
    latitude: float
    longitude: float
    address: Optional[str] = None
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    wind_speed: Optional[float] = None
    solar_radiation: Optional[float] = None
    heatwave_probability: Optional[float] = None
    heatwave_risk_level: Optional[str] = None
    thermal_stress: Optional[float] = None
    personal_risk_score: Optional[float] = None
    vulnerability_category: Optional[str] = None
    hospital: Optional[SOSHospitalInfo] = None
    emergency_contact: Optional[SOSEmergencyContactInfo] = None
    nearest_facility_id: Optional[str] = None
    nearest_facility_name: Optional[str] = None
    nearest_facility_type: Optional[str] = None
    nearest_facility_distance_km: Optional[float] = None
    status: str
    created_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        orm_mode = True

class Facility(BaseModel):
    id: str
    name: str
    type: str # Medical, Cooling Center, etc.
    distance_km: float
    latitude: float
    longitude: float
    address: Optional[str] = None
    phone: Optional[str] = None
    rating: Optional[float] = None
    is_open: Optional[bool] = None

class SOSNearbyResponse(BaseModel):
    facilities: List[Facility]
    
class SOSUpdate(BaseModel):
    status: str # RESOLVED, CANCELLED
