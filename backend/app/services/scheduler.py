"""
HeatShield AI – Background Weather Data Scheduler
===================================================
Runs every WEATHER_UPDATE_INTERVAL_MINUTES (default: 15 minutes).

For each active location stored in PostgreSQL:
  1. Fetch current weather from Open-Meteo
  2. Store WeatherData record
  3. Run heatwave prediction → store Prediction record
  4. Calculate thermal stress → store ThermalStressRecord
  5. Calculate UHI estimate → store UHIData record
  6. Evaluate alert conditions → store Alert if threshold met

The ML model is loaded once at startup and reused on every tick.
The model is NOT retrained during scheduling.
"""
import logging
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session

from app.database.models import (
    Location, WeatherData, Prediction, ThermalStressRecord, UHIData
)
from app.database.session import SessionLocal
from app.ml.predict import predict_heatwave
from app.services.alert_engine import evaluate_and_create_alert
from app.services.risk_engine import classify_risk
from app.services.thermal_stress import thermal_stress_score
from app.services.uhi_engine import compute_uhi
from app.services.weather_service import WeatherUnavailableError, get_current_weather
from app.utils.config import get_settings

logger = logging.getLogger("heatshield.scheduler")
settings = get_settings()

_scheduler = None


def collect_weather_for_location(db: Session, location: Location) -> None:
    """
    Full data-collection pipeline for a single location.
    Errors are logged but do not abort the scheduler.
    """
    city = location.city or location.name
    lat = location.latitude
    lon = location.longitude

    # ── 1. Fetch live weather from Open-Meteo ────────────────────────────────
    try:
        w = get_current_weather(lat, lon, city=city)
    except WeatherUnavailableError as e:
        logger.warning(f"[{city}] Weather unavailable: {e}")
        return
    except Exception as e:
        logger.error(f"[{city}] Unexpected weather error: {e}")
        return

    temp = w["temperature"]
    humidity = w["humidity"]
    wind = w["wind_speed"]
    solar = w["solar_radiation"]
    pressure = w["pressure"]
    precip = w["precipitation"]
    dew = w["dew_point"]
    apparent = w["apparent_temperature"]
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # ── 2. Store WeatherData ──────────────────────────────────────────────────
    wd = WeatherData(
        location_id=location.id,
        timestamp=now,
        temperature=temp,
        humidity=humidity,
        wind_speed=wind,
        pressure=pressure,
        solar_radiation=solar,
        precipitation=precip,
        dew_point=dew,
        apparent_temperature=apparent,
        data_source="Open-Meteo",
        created_at=now,
    )
    db.add(wd)

    # ── 3. Heatwave prediction ────────────────────────────────────────────────
    from datetime import datetime as dt
    features = {
        "temperature": temp,
        "max_temperature": temp + 3.0,
        "min_temperature": temp - 4.0,
        "humidity": humidity,
        "wind_speed": wind,
        "pressure": pressure,
        "solar_radiation": solar,
        "precipitation": precip,
        "dew_point": dew,
        "latitude": lat,
        "longitude": lon,
        "day_of_year": now.timetuple().tm_yday,
        "month": now.month,
    }
    pred = predict_heatwave(features)
    hw_prob = pred["heatwave_probability"]
    model_src = pred["model_source"]

    # ── 4. Thermal stress ─────────────────────────────────────────────────────
    ts = thermal_stress_score(temp, humidity, wind, solar)
    stress_score = ts["stress_score"]
    stress_level = ts["category"]
    heat_idx = ts["heat_index"]

    # ── 5. Risk classification ────────────────────────────────────────────────
    risk = classify_risk(hw_prob, stress_score, temp)

    # ── 6. Store Prediction ───────────────────────────────────────────────────
    pred_rec = Prediction(
        location_id=location.id,
        timestamp=now,
        heatwave_probability=hw_prob,
        risk_level=risk,
        model_version="1.0.0",
        model_source=model_src,
        created_at=now,
    )
    db.add(pred_rec)

    # ── 7. Store ThermalStressRecord ──────────────────────────────────────────
    ts_rec = ThermalStressRecord(
        location_id=location.id,
        timestamp=now,
        temperature=temp,
        humidity=humidity,
        heat_index=heat_idx,
        thermal_stress_score=stress_score,
        thermal_stress_level=stress_level,
        created_at=now,
    )
    db.add(ts_rec)

    # ── 8. UHI estimate (observation-based, not satellite) ────────────────────
    try:
        uhi_result = compute_uhi(urban_temp=temp, is_demo=False)
        uhi_rec = UHIData(
            location_id=location.id,
            timestamp=now,
            urban_temperature=temp,
            reference_temperature=uhi_result["reference_temperature"],
            uhi_intensity=uhi_result["uhi_intensity"],
            uhi_level=uhi_result["risk_level"],
            land_cover="CBD",
            data_note=(
                "UHI estimate based on available temperature observations. "
                "Satellite-derived land-surface temperature not yet integrated."
            ),
            created_at=now,
        )
        db.add(uhi_rec)
    except Exception as e:
        logger.warning(f"[{city}] UHI calculation skipped: {e}")

    # ── 9. Evaluate alerts ────────────────────────────────────────────────────
    try:
        evaluate_and_create_alert(
            db=db,
            location=location,
            heatwave_probability=hw_prob,
            thermal_stress_score=stress_score,
            temperature=temp,
            risk_level=risk,
        )
    except Exception as e:
        logger.warning(f"[{city}] Alert evaluation error: {e}")

    db.commit()
    logger.info(
        f"[{city}] ✅ Collected — T={temp}°C, RH={humidity}%, "
        f"HW={hw_prob:.1f}%, Risk={risk}, Stress={stress_level}"
    )


def _scheduler_job():
    """The main job function called by APScheduler every N minutes."""
    logger.info("🔄 Scheduler tick – collecting weather for all active locations…")
    db = SessionLocal()
    try:
        locations = db.query(Location).filter(Location.is_active == True).all()
        if not locations:
            logger.info("   No active locations found.")
            return
        for loc in locations:
            try:
                collect_weather_for_location(db, loc)
            except Exception as e:
                logger.error(f"   Error processing location {loc.name}: {e}")
                db.rollback()
    finally:
        db.close()


def start_scheduler():
    """Start the APScheduler background scheduler."""
    global _scheduler
    if _scheduler is not None and _scheduler.running:
        logger.info("Scheduler already running.")
        return

    interval = settings.WEATHER_UPDATE_INTERVAL_MINUTES
    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(
        _scheduler_job,
        trigger=IntervalTrigger(minutes=interval),
        id="weather_collection",
        name=f"Weather Collection (every {interval} min)",
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=60,
    )
    _scheduler.start()
    logger.info(f"⏱️  Scheduler started – collecting weather every {interval} minutes.")

    # Run once immediately on startup
    _scheduler_job()


def stop_scheduler():
    """Gracefully stop the scheduler."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("⏹️  Scheduler stopped.")
