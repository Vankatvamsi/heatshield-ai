from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database.models import User
from app.database.session import get_db
from app.schemas.sos import SOSCreate, SOSResponse, SOSNearbyResponse, SOSUpdate
from app.services.sos_service import (
    create_sos_event,
    get_sos_event,
    get_nearby_facilities,
    resolve_sos_event,
)
from app.utils.security import decode_access_token

router = APIRouter(prefix="/api/sos", tags=["sos"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def get_current_user_optional(token: Optional[str] = Depends(OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)), db: Session = Depends(get_db)) -> Optional[User]:
    if not token:
        return None
    payload = decode_access_token(token)
    if payload is None:
        return None
    sub = payload.get("sub")
    if sub is None:
        return None
    try:
        user_id = int(sub)
    except (ValueError, TypeError):
        user_id = sub
    user = db.query(User).filter(User.id == user_id).first()
    return user

@router.post("", response_model=SOSResponse)
def trigger_sos(
    data: SOSCreate,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Trigger a HeatSafe SOS event.
    """
    user_id = current_user.id if current_user else None
    sos_event = create_sos_event(db, user_id, data)
    return sos_event

@router.get("/nearby-assistance", response_model=SOSNearbyResponse)
def find_nearby_assistance(
    latitude: float = Query(...),
    longitude: float = Query(...),
):
    """
    Find nearby emergency and heat-relief facilities.
    """
    facilities = get_nearby_facilities(latitude, longitude)
    return {"facilities": facilities}

@router.get("/{id}", response_model=SOSResponse)
def get_sos(
    id: int,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Get SOS event details.
    """
    user_id = current_user.id if current_user else None
    sos_event = get_sos_event(db, id, user_id)
    if not sos_event:
        raise HTTPException(status_code=404, detail="SOS event not found or unauthorized")
    return sos_event

@router.patch("/{id}/resolve", response_model=SOSResponse)
def resolve_sos(
    id: int,
    data: SOSUpdate,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Resolve an active SOS.
    """
    user_id = current_user.id if current_user else None
    sos_event = resolve_sos_event(db, id, user_id, data.status)
    if not sos_event:
        raise HTTPException(status_code=404, detail="SOS event not found or unauthorized")
    return sos_event
