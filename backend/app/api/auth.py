"""
HeatShield AI – Authentication API Router
POST /api/auth/register     — User or Admin registration
POST /api/auth/login        — Role-aware login (no account type needed)
GET  /api/auth/profile      — Current user profile
GET  /api/profile           — Alias for /api/auth/profile
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database.models import (
    AdminRegistrationRequest, Location, User, UserProfile as UserProfileModel
)
from app.database.session import get_db
from app.schemas.auth import (
    LoginRequest, RegisterRequest, TokenResponse, UserProfile
)
from app.services.email_service import send_admin_request_notification
from app.utils.config import get_settings
from app.utils.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)

logger = logging.getLogger("heatshield.auth")
router = APIRouter(prefix="/api/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
settings = get_settings()


# ── Dependency: get current authenticated user ────────────────────────────────

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


def get_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Require the user to have status=active."""
    if current_user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not active. Contact the administrator."
        )
    return current_user


def get_admin_user(current_user: User = Depends(get_active_user)) -> User:
    """Require admin or super_admin role."""
    if current_user.role not in ("admin", "super_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def get_super_admin_user(current_user: User = Depends(get_active_user)) -> User:
    """Require super_admin role only."""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super admin access required")
    return current_user


# ── Register ──────────────────────────────────────────────────────────────────

@router.post("/register", status_code=201)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    """
    Unified registration endpoint.
    - account_type='user'  → role=user, status=active, immediately usable.
    - account_type='admin' → role=admin, status=pending, requires super-admin approval.
    """
    # Check for duplicate email
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    account_type = req.account_type.lower().strip()
    if account_type not in ("user", "admin"):
        raise HTTPException(status_code=400, detail="account_type must be 'user' or 'admin'")

    if account_type == "user":
        # ── User registration: immediately active ──────────────────────────
        user = User(
            name=req.name,
            email=req.email,
            password_hash=hash_password(req.password),
            role="user",
            status="active",
        )
        db.add(user)
        db.flush()

        # Create default heat-health profile using registration fields
        default_loc = db.query(Location).first()
        profile = UserProfileModel(
            user_id=user.id,
            age_group=req.age_group or "18-44",
            vulnerability_category=req.vulnerability_category or "General Population",
            activity_level=req.activity_level or "Mostly Indoor",
            water_access=req.water_access or "Always available",
            heat_sensitivity=req.heat_sensitivity or "No",
            default_location_id=default_loc.id if default_loc else None,
            alert_threshold=req.alert_threshold or "High and Extreme",
            alerts_enabled=req.alerts_enabled if req.alerts_enabled is not None else True,
        )
        db.add(profile)
        db.commit()
        db.refresh(user)

        token = create_access_token({"sub": str(user.id)})
        logger.info("✅ New user registered: %s (role=user, status=active)", user.email)
        return TokenResponse(
            access_token=token,
            user_id=user.id,
            name=user.name,
            email=user.email,
            role=user.role,
            status=user.status,
        )

    else:
        # ── Admin registration: pending approval ───────────────────────────
        user = User(
            name=req.name,
            email=req.email,
            password_hash=hash_password(req.password),
            role="admin",
            status="pending",
        )
        db.add(user)
        db.flush()

        # Create admin registration request with secure token
        token_value = AdminRegistrationRequest.generate_token()
        admin_req = AdminRegistrationRequest(
            user_id=user.id,
            approval_token=token_value,
            token_used=False,
            token_expires_at=AdminRegistrationRequest.token_expiry_hours(72),
            status="pending",
        )
        db.add(admin_req)
        db.commit()
        db.refresh(user)
        db.refresh(admin_req)

        # Send email notification to super admin
        try:
            send_admin_request_notification(
                applicant_name=user.name,
                applicant_email=user.email,
                request_id=admin_req.id,
                approval_token=token_value,
            )
        except Exception as e:
            logger.error("Email notification failed: %s", e)

        logger.info(
            "📋 Admin request registered: %s (status=pending, request_id=%d)",
            user.email, admin_req.id
        )
        return {
            "message": "Your administrator account request has been submitted for approval.",
            "status": "pending",
            "user_id": user.id,
            "email": user.email,
            "name": user.name,
            "role": "admin",
        }


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """
    Email + password login only. No account type needed.
    The backend automatically detects role and status from PostgreSQL.
    """
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Status guard — do NOT issue token for non-active accounts
    if user.status == "pending":
        raise HTTPException(
            status_code=403,
            detail="Your administrator account is awaiting approval from the primary administrator."
        )
    if user.status == "rejected":
        raise HTTPException(
            status_code=403,
            detail="Your account request was not approved. Please contact the administrator."
        )
    if user.status == "suspended":
        raise HTTPException(
            status_code=403,
            detail="Your account has been suspended. Please contact the administrator."
        )

    token = create_access_token({"sub": str(user.id)})
    logger.info("🔐 Login: %s (role=%s, status=%s)", user.email, user.role, user.status)
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        status=user.status,
    )


# ── Profile ───────────────────────────────────────────────────────────────────

@router.get("/profile", response_model=UserProfile)
def auth_profile(current_user: User = Depends(get_current_user)):
    return current_user


# ── Convenience alias ─────────────────────────────────────────────────────────
# /api/profile (used by existing frontend code)
profile_router = APIRouter(prefix="/api", tags=["auth"])

@profile_router.get("/profile", response_model=UserProfile)
def profile_alias(current_user: User = Depends(get_current_user)):
    return current_user
