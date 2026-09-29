"""
HeatShield AI – Feature 8 & Feature 9 Test Suite
================================================
Comprehensive tests for:
  - Feature 8: Personalized Heat-Health Risk Assessment
  - Feature 9: Live Location-Based Heat Protection
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

import pytest
from fastapi.testclient import TestClient

from app.database.init_db import init_db
from app.main import app
from app.utils.config import get_settings

settings = get_settings()

@pytest.fixture(scope="session", autouse=True)
def setup_db():
    try:
        init_db()
    except Exception as e:
        print(f"DB Init note: {e}")

client = TestClient(app)


def _get_auth_token():
    email = "feature_test_user@heatshield.ai"
    password = "testpassword123"
    r_reg = client.post("/api/auth/register", json={
        "name": "Feature Test User",
        "email": email,
        "password": password,
    })
    if r_reg.status_code == 201:
        return r_reg.json()["access_token"]
    r_login = client.post("/api/auth/login", json={
        "email": email,
        "password": password,
    })
    assert r_login.status_code == 200
    return r_login.json()["access_token"]


# ── Feature 8: Profile & Personal Risk Assessment ─────────────────────────────

def test_get_and_update_heat_health_profile():
    token = _get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Get profile
    r = client.get("/api/profile", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert "age_group" in data
    assert "vulnerability_category" in data
    assert "activity_level" in data
    assert "water_access" in data

    # 2. Update profile
    update_payload = {
        "age_group": "45-64",
        "vulnerability_category": "Outdoor Worker",
        "activity_level": "Heavy Physical Activity",
        "water_access": "Usually unavailable",
        "heat_sensitivity": "Yes",
        "alert_threshold": "High and Extreme",
        "alerts_enabled": True,
    }
    r = client.put("/api/profile", json=update_payload, headers=headers)
    assert r.status_code == 200
    updated = r.json()
    assert updated["vulnerability_category"] == "Outdoor Worker"
    assert updated["activity_level"] == "Heavy Physical Activity"
    assert updated["water_access"] == "Usually unavailable"
    assert updated["heat_sensitivity"] == "Yes"


def test_personal_risk_recalculation_on_profile_changes():
    token = _get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Baseline scenario: General Population, Mostly Indoor, Always Available Water
    r_baseline = client.post("/api/personal-risk/assess", json={
        "city": "Hyderabad",
        "latitude": 17.385,
        "longitude": 78.486,
        "temperature": 38.0,
        "humidity": 50.0,
        "age_group": "18-44",
        "vulnerability_category": "General Population",
        "activity_level": "Mostly Indoor",
        "water_access": "Always available",
        "heat_sensitivity": "No",
    }, headers=headers)
    assert r_baseline.status_code == 200
    baseline_data = r_baseline.json()
    baseline_score = baseline_data["personal_risk_score"]

    # High vulnerability scenario: Outdoor Worker, Heavy Physical Activity, Unavailable Water
    r_high_risk = client.post("/api/personal-risk/assess", json={
        "city": "Hyderabad",
        "latitude": 17.385,
        "longitude": 78.486,
        "temperature": 38.0,
        "humidity": 50.0,
        "age_group": "18-44",
        "vulnerability_category": "Outdoor Worker",
        "activity_level": "Heavy Physical Activity",
        "water_access": "Usually unavailable",
        "heat_sensitivity": "Yes",
    }, headers=headers)
    assert r_high_risk.status_code == 200
    high_risk_data = r_high_risk.json()
    high_risk_score = high_risk_data["personal_risk_score"]

    # Changing profile MUST increase the risk score
    assert high_risk_score > baseline_score
    assert len(high_risk_data["main_risk_factors"]) > 0
    assert any("Outdoor Worker" in f for f in high_risk_data["main_risk_factors"])
    assert any("Heavy Physical Activity" in f for f in high_risk_data["main_risk_factors"])
    assert "disclaimer" in high_risk_data


def test_can_go_outside_and_precautions():
    token = _get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Test "Can I Go Outside Now?"
    r = client.post("/api/personal-risk/can-go-out", json={
        "city": "Hyderabad",
        "latitude": 17.385,
        "longitude": 78.486,
        "temperature": 42.0,
        "humidity": 55.0,
        "activity_level": "Heavy Physical Activity",
        "vulnerability_category": "Outdoor Worker",
    }, headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert "can_go_outside" in data
    assert data["can_go_outside"]["code"] in ("LOWER_RISK", "GO_WITH_CAUTION", "AVOID_IF_POSSIBLE", "HIGH_RISK")
    assert "badge" in data["can_go_outside"]

    # Test "I MUST GO OUT" precautions
    r_prec = client.post("/api/personal-risk/precautions", json={
        "city": "Hyderabad",
        "latitude": 17.385,
        "longitude": 78.486,
        "temperature": 42.0,
        "humidity": 55.0,
        "vulnerability_category": "Elderly",
        "water_access": "Usually unavailable",
    }, headers=headers)
    assert r_prec.status_code == 200
    prec_data = r_prec.json()
    assert "precautions" in prec_data
    assert len(prec_data["precautions"]) >= 3
    assert any(p["category"] == "Hydration" for p in prec_data["precautions"])


# ── Feature 9: Live Location Protection ───────────────────────────────────────

def test_live_location_protection_lifecycle():
    token = _get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Start live protection session
    r_start = client.post("/api/live-protection/start", headers=headers)
    assert r_start.status_code == 200
    start_data = r_start.json()
    assert start_data["status"] == "ok"
    assert start_data["active"] is True
    session_id = start_data["session_id"]
    assert session_id is not None

    # 2. Check status
    r_status = client.get("/api/live-protection/status", headers=headers)
    assert r_status.status_code == 200
    assert r_status.json()["active"] is True

    # 3. Send location coordinates (Hyderabad coordinates)
    r_loc = client.post("/api/live-protection/location", json={
        "latitude": 17.385,
        "longitude": 78.486,
    }, headers=headers)
    assert r_loc.status_code == 200
    loc_data = r_loc.json()["data"]
    assert "weather" in loc_data
    assert "assessment" in loc_data
    assert "escalation_detected" in loc_data
    assert loc_data["weather"]["data_source"] == "Open-Meteo"

    # 4. Check history
    r_hist = client.get("/api/live-protection/history?limit=5", headers=headers)
    assert r_hist.status_code == 200
    assert r_hist.json()["count"] >= 1

    # 5. Stop live protection
    r_stop = client.post("/api/live-protection/stop", headers=headers)
    assert r_stop.status_code == 200
    assert r_stop.json()["active"] is False

    # 6. Verify status is now inactive
    r_status_after = client.get("/api/live-protection/status", headers=headers)
    assert r_status_after.status_code == 200
    assert r_status_after.json()["active"] is False
