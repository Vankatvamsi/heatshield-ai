"""
HeatShield AI – Live Location Protection API Router
====================================================
Endpoints:
  POST /api/live-protection/start
  POST /api/live-protection/location
  POST /api/live-protection/stop
  GET  /api/live-protection/status
  GET  /api/live-protection/history
"""
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database.models import User
from app.database.session import get_db
from app.schemas.personal_risk import (
    LiveLocationUpdateRequest,
    LiveProtectionStatusResponse,
)
from app.services.live_protection_service import (
    get_live_protection_history,
    get_live_protection_status,
    process_live_location_update,
    start_live_protection_session,
    stop_live_protection_session,
)
from app.utils.security import decode_access_token

router = APIRouter(prefix="/api/live-protection", tags=["live-protection"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


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


@router.post("/start")
def start_live_protection(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Start active live location heat protection session for the user.
    """
    session = start_live_protection_session(db, current_user.id)
    return {
        "status": "ok",
        "message": "Live Heat Protection session started.",
        "session_id": session.id,
        "started_at": session.started_at.isoformat() if session.started_at else None,
        "active": True,
        "privacy_notice": (
            "HeatShield AI is now monitoring heat risks for your active location. "
            "Coordinates are stored privately and tracking stops when you end the session."
        ),
    }


@router.post("/location")
def update_live_location(
    req: LiveLocationUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Ingest live GPS coordinates, fetch live Open-Meteo weather for exact location,
    evaluate personal heat risk, and trigger escalation alerts if dangerous heat is detected.
    """
    if req.latitude < -90.0 or req.latitude > 90.0 or req.longitude < -180.0 or req.longitude > 180.0:
        raise HTTPException(status_code=400, detail="Invalid latitude or longitude coordinates.")

    try:
        result = process_live_location_update(
            db=db,
            user_id=current_user.id,
            latitude=req.latitude,
            longitude=req.longitude,
        )
        return {"status": "ok", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error evaluating live location risk: {str(e)}")


@router.post("/stop")
def stop_live_protection(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Stop active live location tracking session.
    """
    session = stop_live_protection_session(db, current_user.id)
    return {
        "status": "ok",
        "message": "Live Heat Protection session stopped.",
        "session_id": session.id if session else None,
        "active": False,
    }


@router.get("/status", response_model=LiveProtectionStatusResponse)
def get_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Check current live protection status and latest heat risk telemetry.
    """
    return get_live_protection_status(db, current_user.id)


@router.get("/history")
def get_history(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve user's past live tracking sessions and location checkpoints.
    """
    history = get_live_protection_history(db, current_user.id, limit=limit)
    return {
        "status": "ok",
        "count": len(history),
        "data": history,
    }
