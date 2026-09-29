"""
HeatShield AI – Backend Tests
Ensures all core API endpoints and Open-Meteo services work correctly.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database.init_db import init_db
from app.utils.config import get_settings

settings = get_settings()

@pytest.fixture(scope="session", autouse=True)
def setup_db():
    try:
        init_db()
    except Exception as e:
        print(f"DB Init note: {e}")

client = TestClient(app)


# ── Health ─────────────────────────────────────────────────────────────────────
def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["data_source"] == "Open-Meteo"
    assert data["database"] == "PostgreSQL"


# ── Auth ───────────────────────────────────────────────────────────────────────
def test_register_and_login():
    email = f"tester_{int(pytest.__version__.replace('.', '')[:4])}@heatshield.ai"
    # Register
    r = client.post("/api/auth/register", json={"name": "Test User", "email": email, "password": "testpassword123"})
    assert r.status_code in (201, 400)  # 400 if already registered

    # Login with admin
    r = client.post("/api/auth/login", json={"email": settings.DEMO_USER_EMAIL, "password": settings.DEMO_USER_PASSWORD})
    if r.status_code == 200:
        data = r.json()
        assert "access_token" in data


def test_login_invalid():
    r = client.post("/api/auth/login", json={"email": "nonexistent@example.com", "password": "wrongpassword"})
    assert r.status_code == 401


# ── Locations & Geocoding ──────────────────────────────────────────────────────
def test_locations_list():
    r = client.get("/api/locations")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)


def test_location_geocoding_search():
    r = client.get("/api/locations/search?q=Hyderabad")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert "data" in data


# ── Weather (Open-Meteo Live) ──────────────────────────────────────────────────
def test_current_weather():
    r = client.get("/api/weather/current?city=Hyderabad&lat=17.385&lon=78.486")
    assert r.status_code in (200, 503)
    if r.status_code == 200:
        data = r.json()
        assert data["status"] == "ok"
        assert data["data_source"] == "Open-Meteo"
        assert "temperature" in data["data"]
        assert "humidity" in data["data"]


def test_forecast():
    r = client.get("/api/weather/forecast?city=Hyderabad&lat=17.385&lon=78.486")
    assert r.status_code in (200, 503)
    if r.status_code == 200:
        data = r.json()
        assert len(data["data"]) == 4  # 6h, 12h, 24h, 48h


# ── Prediction ─────────────────────────────────────────────────────────────────
def test_heatwave_prediction():
    r = client.post("/api/predict/heatwave", json={
        "city": "Hyderabad", "latitude": 17.385, "longitude": 78.486,
        "temperature": 43.5, "humidity": 55.0
    })
    assert r.status_code == 200
    data = r.json()
    assert "heatwave_probability" in data
    assert 0 <= data["heatwave_probability"] <= 100
    assert data["risk_level"] in ("LOW", "MODERATE", "HIGH", "EXTREME")


def test_thermal_stress():
    r = client.post("/api/predict/thermal-stress", json={
        "temperature": 42.0, "humidity": 50.0, "wind_speed": 12.0, "solar_radiation": 750.0
    })
    assert r.status_code == 200
    data = r.json()
    assert "stress_score" in data
    assert 0 <= data["stress_score"] <= 100
    assert data["category"] in ("LOW", "MODERATE", "ELEVATED", "HIGH", "EXTREME")


def test_forecast_predictions():
    r = client.get("/api/predict/forecast?city=Hyderabad&lat=17.385&lon=78.486")
    assert r.status_code in (200, 503)
    if r.status_code == 200:
        items = r.json()["data"]
        assert len(items) == 4
        for item in items:
            assert "heatwave_probability" in item
            assert "risk_level" in item


# ── Risk Map ───────────────────────────────────────────────────────────────────
def test_risk_map():
    r = client.get("/api/risk/map")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["data_source"] == "Open-Meteo"


# ── UHI ────────────────────────────────────────────────────────────────────────
def test_uhi_hotspots():
    r = client.get("/api/uhi/hotspots?city=Hyderabad&lat=17.385&lon=78.486")
    assert r.status_code == 200
    data = r.json()
    assert "data" in data


def test_uhi_compute():
    r = client.get("/api/uhi/compute?urban_temp=41.5&land_cover=CBD&vegetation_index=0.2")
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert "uhi_intensity" in data["data"]


# ── Vulnerable Population ──────────────────────────────────────────────────────
def test_vulnerable_risk():
    r = client.post("/api/vulnerable/risk", json={
        "city": "Hyderabad", "latitude": 17.385, "longitude": 78.486,
        "category": "outdoor_worker"
    })
    assert r.status_code in (200, 503)
    if r.status_code == 200:
        data = r.json()
        assert "vulnerable_assessment" in data
        va = data["vulnerable_assessment"]
        assert va["adjusted_risk"] in ("LOW", "MODERATE", "HIGH", "EXTREME")


# ── Alerts ─────────────────────────────────────────────────────────────────────
def test_alerts_list():
    r = client.get("/api/alerts")
    assert r.status_code == 200
    data = r.json()
    assert "data" in data


def test_alerts_evaluate():
    r = client.post("/api/alerts/evaluate?city=Hyderabad&lat=17.385&lon=78.486")
    assert r.status_code in (200, 404, 503)


# ── Historical ─────────────────────────────────────────────────────────────────
def test_historical_data():
    r = client.get("/api/history?city=Hyderabad")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"


# ── Settings ───────────────────────────────────────────────────────────────────
def test_settings_mode():
    r = client.get("/api/settings/mode")
    assert r.status_code == 200
    data = r.json()
    assert data["mode"] == "live"
    assert data["is_demo"] is False
    assert data["label"] == "LIVE DATA"
    assert data["data_source"] == "Open-Meteo"


def test_settings_thresholds():
    r = client.get("/api/settings/thresholds")
    assert r.status_code == 200
    data = r.json()
    assert "thresholds" in data
