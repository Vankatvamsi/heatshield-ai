from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict


# ── Registration ──────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    """
    Unified registration request.
    account_type: 'user' or 'admin'
    Admin registrations are created as status=pending and require approval.
    User registrations are immediately active.
    """
    account_type: str = "user"   # user | admin
    name: str
    email: EmailStr
    password: str
    # Optional fields pre-populated during user registration
    age_group: Optional[str] = "18-44"
    vulnerability_category: Optional[str] = "General Population"
    activity_level: Optional[str] = "Mostly Indoor"
    water_access: Optional[str] = "Always available"
    heat_sensitivity: Optional[str] = "No"
    alert_threshold: Optional[str] = "High and Extreme"
    alerts_enabled: Optional[bool] = True


# ── Login ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ── Responses ────────────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    name: str
    email: str
    role: str = "user"
    status: str = "active"


class UserProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    role: str = "user"
    status: str = "active"


class AdminRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    status: str
    token_used: bool
    token_expires_at: str
    created_at: str
    applicant_name: Optional[str] = None
    applicant_email: Optional[str] = None
