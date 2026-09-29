import os
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.utils.config import get_settings

settings = get_settings()
client = TestClient(app)


def test_user_registration_immediately_active():
    unique_id = str(uuid.uuid4())[:8]
    email = f"user_{unique_id}@example.com"
    payload = {
        "account_type": "user",
        "name": "Regular User",
        "email": email,
        "password": "userpass123",
        "age_group": "18-44",
        "vulnerability_category": "General Population",
        "activity_level": "Mostly Indoor"
    }
    r = client.post("/api/auth/register", json=payload)
    assert r.status_code == 201
    data = r.json()
    assert data["role"] == "user"
    assert data["status"] == "active"
    assert "access_token" in data


def test_admin_registration_creates_pending_request():
    unique_id = str(uuid.uuid4())[:8]
    email = f"admin_{unique_id}@example.com"
    payload = {
        "account_type": "admin",
        "name": "Pending Admin Applicant",
        "email": email,
        "password": "adminpass123"
    }
    r = client.post("/api/auth/register", json=payload)
    assert r.status_code == 201
    data = r.json()
    assert data["status"] == "pending"
    assert data["role"] == "admin"

    # Attempt login with pending account -> MUST be blocked (403)
    login_r = client.post("/api/auth/login", json={"email": email, "password": "adminpass123"})
    assert login_r.status_code == 403
    assert "awaiting approval" in login_r.json()["detail"]


def test_super_admin_login_and_approval():
    # Login as primary Super Admin
    r = client.post("/api/auth/login", json={"email": settings.SUPER_ADMIN_EMAIL, "password": settings.SUPER_ADMIN_PASSWORD})
    assert r.status_code == 200
    token = r.json()["access_token"]
    assert r.json()["role"] == "super_admin"
    assert r.json()["status"] == "active"

    headers = {"Authorization": f"Bearer {token}"}

    # Register another admin request to approve
    unique_id = str(uuid.uuid4())[:8]
    email = f"to_approve_{unique_id}@example.com"
    reg = client.post("/api/auth/register", json={"account_type": "admin", "name": "Approve Me", "email": email, "password": "pass"})
    assert reg.status_code == 201

    # Fetch pending requests as super admin
    reqs_res = client.get("/api/admin/requests", headers=headers)
    assert reqs_res.status_code == 200
    requests_list = reqs_res.json()["data"]
    target_req = next(r for r in requests_list if r["applicant_email"] == email)

    # Approve request
    app_res = client.post(f"/api/admin/requests/{target_req['id']}/approve", headers=headers)
    assert app_res.status_code == 200
    assert app_res.json()["status"] == "approved"

    # Now login with approved admin -> MUST succeed!
    login_r = client.post("/api/auth/login", json={"email": email, "password": "pass"})
    assert login_r.status_code == 200
    assert login_r.json()["role"] == "admin"
    assert login_r.json()["status"] == "active"


def test_admin_users_list_endpoint():
    # Login as super admin
    r = client.post("/api/auth/login", json={"email": settings.SUPER_ADMIN_EMAIL, "password": settings.SUPER_ADMIN_PASSWORD})
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    users_res = client.get("/api/admin/users", headers=headers)
    assert users_res.status_code == 200
    assert "data" in users_res.json()
    assert users_res.json()["total"] >= 1
