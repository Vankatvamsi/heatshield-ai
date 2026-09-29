"""
HeatShield AI – Admin API Router
Endpoints:
  GET  /api/admin/requests                — List pending admin registration requests (Super Admin only)
  POST /api/admin/requests/{id}/approve   — Approve an admin request (Super Admin or via secure token)
  POST /api/admin/requests/{id}/reject    — Reject an admin request (Super Admin or via secure token)
  GET  /api/admin/users                   — List all users with roles/status (Admin / Super Admin)
"""
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.auth import get_admin_user, get_current_user, get_super_admin_user
from app.database.models import AdminRegistrationRequest, User
from app.database.session import get_db
from app.services.email_service import send_admin_approved_email, send_admin_rejected_email

logger = logging.getLogger("heatshield.admin_api")
router = APIRouter(prefix="/api/admin", tags=["admin"])


# ── GET /api/admin/requests ───────────────────────────────────────────────────

@router.get("/requests")
def list_admin_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """List all admin registration requests. Restricted to Super Admin."""
    requests = db.query(AdminRegistrationRequest).order_by(AdminRegistrationRequest.created_at.desc()).all()
    results = []
    for r in requests:
        user = db.query(User).filter(User.id == r.user_id).first()
        results.append({
            "id": r.id,
            "user_id": r.user_id,
            "applicant_name": user.name if user else "Unknown",
            "applicant_email": user.email if user else "Unknown",
            "status": r.status,
            "token_used": r.token_used,
            "token_expires_at": r.token_expires_at.isoformat() if r.token_expires_at else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
        })
    return {"data": results, "total": len(results)}


# ── POST /api/admin/requests/{id}/approve ─────────────────────────────────────

@router.post("/requests/{request_id}/approve")
def approve_admin_request(
    request_id: int,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Approve an admin registration request.
    Can be authenticated by Super Admin JWT OR single-use expiring approval token from email.
    """
    req = db.query(AdminRegistrationRequest).filter(AdminRegistrationRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Admin registration request not found")

    if req.status != "pending":
        raise HTTPException(status_code=400, detail=f"Request has already been processed (status: {req.status})")

    # If token is provided, validate single-use and expiration
    if token:
        if req.approval_token != token:
            raise HTTPException(status_code=400, detail="Invalid approval token")
        if req.token_used:
            raise HTTPException(status_code=400, detail="Token has already been used")
        if req.token_expires_at and req.token_expires_at < datetime.utcnow():
            raise HTTPException(status_code=400, detail="Approval token has expired")

    # Update applicant user status
    user = db.query(User).filter(User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Applicant user not found")

    user.role = "admin"
    user.status = "active"

    # Mark request as approved & token as used
    req.status = "approved"
    req.token_used = True
    req.resolved_at = datetime.utcnow()

    db.commit()

    # Send confirmation email to applicant
    try:
        send_admin_approved_email(user.name, user.email)
    except Exception as e:
        logger.error("Failed to send approval email: %s", e)

    logger.info("✅ Admin request #%d APPROVED for %s", request_id, user.email)
    return {
        "message": f"Administrator account for {user.name} ({user.email}) has been approved.",
        "request_id": request_id,
        "status": "approved",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "status": user.status,
        }
    }


# ── POST /api/admin/requests/{id}/reject ──────────────────────────────────────

@router.post("/requests/{request_id}/reject")
def reject_admin_request(
    request_id: int,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Reject an admin registration request.
    Can be authenticated by Super Admin JWT OR single-use approval token.
    """
    req = db.query(AdminRegistrationRequest).filter(AdminRegistrationRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Admin registration request not found")

    if req.status != "pending":
        raise HTTPException(status_code=400, detail=f"Request has already been processed (status: {req.status})")

    if token:
        if req.approval_token != token:
            raise HTTPException(status_code=400, detail="Invalid approval token")
        if req.token_used:
            raise HTTPException(status_code=400, detail="Token has already been used")

    user = db.query(User).filter(User.id == req.user_id).first()
    if user:
        user.status = "rejected"

    req.status = "rejected"
    req.token_used = True
    req.resolved_at = datetime.utcnow()

    db.commit()

    if user:
        try:
            send_admin_rejected_email(user.name, user.email)
        except Exception as e:
            logger.error("Failed to send rejection email: %s", e)

    logger.info("❌ Admin request #%d REJECTED", request_id)
    return {
        "message": f"Administrator account request #{request_id} has been rejected.",
        "request_id": request_id,
        "status": "rejected",
    }


# ── GET /api/admin/users ──────────────────────────────────────────────────────

@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """List all registered users with their roles and status. Restricted to Admin / Super Admin."""
    users = db.query(User).order_by(User.created_at.desc()).all()
    results = [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "status": u.status,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]
    return {"data": results, "total": len(results)}


# ── GET /api/admin/admins ─────────────────────────────────────────────────────

@router.get("/admins")
def list_admins(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_super_admin_user),
):
    """
    List only admin and super_admin accounts, enriched with their
    registration request details. Restricted to Super Admin.
    """
    admins = (
        db.query(User)
        .filter(User.role.in_(["admin", "super_admin"]))
        .order_by(User.created_at.desc())
        .all()
    )
    results = []
    for u in admins:
        # Find most recent registration request for this admin
        req = (
            db.query(AdminRegistrationRequest)
            .filter(AdminRegistrationRequest.user_id == u.id)
            .order_by(AdminRegistrationRequest.created_at.desc())
            .first()
        )
        results.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "status": u.status,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "updated_at": u.updated_at.isoformat() if u.updated_at else None,
            # Registration request details (null for super_admin seeded directly)
            "request_id": req.id if req else None,
            "request_status": req.status if req else "seeded",
            "approved_at": req.resolved_at.isoformat() if req and req.resolved_at else None,
            "token_expires_at": req.token_expires_at.isoformat() if req and req.token_expires_at else None,
        })
    return {"data": results, "total": len(results)}
