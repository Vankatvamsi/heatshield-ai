"""
HeatShield AI – Backend Configuration Loader
Reads settings from environment variables / .env file.
"""
import json
import os
from pathlib import Path
from functools import lru_cache

from dotenv import load_dotenv

# Load .env from the backend directory
_env_path = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path=_env_path)


class Settings:
    # ── JWT ──────────────────────────────────────────────────────────────────
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "insecure-dev-key-change-in-production")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

    # ── Database ─────────────────────────────────────────────────────────────
    # Must be a PostgreSQL URL. SQLite is NOT supported in production.
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://postgres:password@localhost:5432/heatshield",
    )

    # ── CORS ─────────────────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = [
        o.strip()
        for o in os.getenv(
            "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",")
    ]

    # ── Model paths ───────────────────────────────────────────────────────────
    MODEL_PATH: Path = Path(os.getenv("MODEL_PATH", "../models/heatwave_model.pkl"))
    PIPELINE_PATH: Path = Path(os.getenv("PIPELINE_PATH", "../models/preprocess.joblib"))
    THRESHOLDS_PATH: Path = Path(os.getenv("THRESHOLDS_PATH", "../config/risk_thresholds.json"))

    # ── Super Admin / Primary Admin ───────────────────────────────────────────
    SUPER_ADMIN_EMAIL: str = os.getenv("SUPER_ADMIN_EMAIL", "")
    SUPER_ADMIN_PASSWORD: str = os.getenv("SUPER_ADMIN_PASSWORD", "")
    SUPER_ADMIN_NAME: str = os.getenv("SUPER_ADMIN_NAME", "Vamsi Admin")

    # Email to notify when a new admin requests access
    ADMIN_APPROVAL_EMAIL: str = os.getenv("ADMIN_APPROVAL_EMAIL", "")

    # ── SMTP Email (for admin approval notifications) ─────────────────────────
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME: str = os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", "noreply@heatshield.ai")
    SMTP_ENABLED: bool = os.getenv("SMTP_HOST", "") != ""

    # ── SMS Provider (TextBee) ────────────────────────────────────────────────
    SMS_PROVIDER: str = os.getenv("SMS_PROVIDER", "")
    TEXTBEE_API_KEY: str = os.getenv("TEXTBEE_API_KEY", "")
    TEXTBEE_DEVICE_ID: str = os.getenv("TEXTBEE_DEVICE_ID", "")
    TEXTBEE_BASE_URL: str = os.getenv("TEXTBEE_BASE_URL", "https://api.textbee.dev/api/v1/gateway/send-sms")
    DEMO_EMERGENCY_CONTACT: str = os.getenv("DEMO_EMERGENCY_CONTACT", "9827500473")

    # ── Scheduler ─────────────────────────────────────────────────────────────
    WEATHER_UPDATE_INTERVAL_MINUTES: int = int(
        os.getenv("WEATHER_UPDATE_INTERVAL_MINUTES", "15")
    )

    # ── Live protection rate-limiting ─────────────────────────────────────────
    LIVE_LOCATION_MIN_DISTANCE_METERS: int = int(
        os.getenv("LIVE_LOCATION_MIN_DISTANCE_METERS", "500")
    )
    LIVE_WEATHER_CHECK_INTERVAL_MINUTES: int = int(
        os.getenv("LIVE_WEATHER_CHECK_INTERVAL_MINUTES", "5")
    )

    # ── Legacy / backward compat ─────────────────────────────────────────────
    # Keep DEMO_USER_EMAIL as alias for SUPER_ADMIN_EMAIL for backward compat
    @property
    def DEMO_USER_EMAIL(self) -> str:
        return self.SUPER_ADMIN_EMAIL

    @property
    def DEMO_USER_PASSWORD(self) -> str:
        return self.SUPER_ADMIN_PASSWORD

    @property
    def DEMO_USER_NAME(self) -> str:
        return self.SUPER_ADMIN_NAME

    def load_thresholds(self) -> dict:
        """Load risk thresholds from config file, fall back to defaults."""
        try:
            backend_dir = Path(__file__).resolve().parents[2]
            path = (backend_dir / self.THRESHOLDS_PATH).resolve()
            with open(path) as f:
                return json.load(f)
        except Exception:
            return {
                "heatwave_probability": {"low": 30, "moderate": 50, "high": 70, "extreme": 85},
                "thermal_stress_score": {"low": 20, "moderate": 40, "elevated": 60, "high": 80, "extreme": 100},
                "temperature_celsius": {"low": 32, "moderate": 37, "high": 40, "extreme": 44},
                "combined_risk": {"low": 20, "moderate": 40, "high": 65, "extreme": 80},
                "alert_thresholds": {
                    "info_probability": 30,
                    "warning_probability": 50,
                    "high_probability": 70,
                    "extreme_probability": 85,
                },
                "uhi_intensity": {"weak": 1.0, "moderate": 2.0, "strong": 3.0, "very_strong": 4.5},
            }


@lru_cache()
def get_settings() -> Settings:
    return Settings()
