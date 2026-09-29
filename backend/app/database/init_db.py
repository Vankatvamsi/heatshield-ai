"""
HeatShield AI – Database Initialisation
Creates all tables and seeds initial location data on first run.
"""
import csv
from pathlib import Path

from app.database.models import (
    Base, Location, HistoricalRecord, User, UserProfile,
    PersonalRiskAssessment, LocationTrackingSession, LocationPoint, Alert,
    UserHealthSensitivity, Journey, RouteRiskSegment, JourneyHealthFeedback,
    SOSEvent
)
from app.database.session import SessionLocal, engine
from app.utils.config import get_settings
from app.utils.security import hash_password

settings = get_settings()

DATA_DIR = Path(__file__).resolve().parents[3] / "data"


def init_db():
    """Create all tables and seed initial data."""
    # Run automatic column migrations for existing PostgreSQL tables
    with engine.connect() as conn:
        try:
            conn.execute(Base.metadata.schema_generator if False else None)
        except Exception:
            pass
        from sqlalchemy import text
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;"))
            
            # SOS Event columns
            conn.execute(text("ALTER TABLE heat_sos_events ADD COLUMN IF NOT EXISTS nearest_facility_distance_km FLOAT;"))
            conn.execute(text("ALTER TABLE heat_sos_events ADD COLUMN IF NOT EXISTS hospital_notification_status VARCHAR(50) DEFAULT 'NOT_SENT';"))
            conn.execute(text("ALTER TABLE heat_sos_events ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50);"))
            conn.execute(text("ALTER TABLE heat_sos_events ADD COLUMN IF NOT EXISTS emergency_contact_notification_status VARCHAR(50) DEFAULT 'NOT_SENT';"))
            conn.execute(text("ALTER TABLE heat_sos_events ADD COLUMN IF NOT EXISTS sms_timestamp TIMESTAMP;"))
            
            conn.commit()
        except Exception as mig_err:
            print(f"Migration note: {mig_err}")

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        _seed_locations(db)
        _seed_historical_records(db)
        _seed_admin_user(db)
        db.commit()
        print("✅  Database initialised successfully.")
    except Exception as e:
        db.rollback()
        print(f"❌  Database init error: {e}")
        raise
    finally:
        db.close()


def _seed_locations(db):
    if db.query(Location).count() > 0:
        return
    loc_file = DATA_DIR / "demo_locations.csv"
    if not loc_file.exists():
        print(f"  ⚠️  demo_locations.csv not found at {loc_file}, skipping.")
        return
    with open(loc_file) as f:
        reader = csv.DictReader(f)
        for row in reader:
            loc = Location(
                id=int(row["id"]),
                name=row["name"],
                latitude=float(row["latitude"]),
                longitude=float(row["longitude"]),
                city=row["city"],
                state=row["state"],
                country=row["country"],
            )
            db.add(loc)
        db.flush()
    print(f"  📍 Seeded locations from {loc_file.name}")


def _seed_historical_records(db):
    if db.query(HistoricalRecord).count() > 0:
        return
    train_file = DATA_DIR / "weather_training.csv"
    if not train_file.exists():
        print(f"  ⚠️  weather_training.csv not found, skipping historical seed.")
        return

    location_map = {loc.city: loc.id for loc in db.query(Location).all()}

    with open(train_file) as f:
        reader = csv.DictReader(f)
        records = []
        for row in reader:
            city = row.get("city", "")
            loc_id = location_map.get(city)
            if loc_id is None:
                continue
            records.append(
                HistoricalRecord(
                    location_id=loc_id,
                    date=row["date"],
                    max_temperature=float(row["max_temperature"]),
                    min_temperature=float(row["min_temperature"]),
                    humidity=float(row["humidity"]),
                    heatwave_label=int(row["heatwave"]),
                )
            )
        db.bulk_save_objects(records)
    print(f"  📊 Seeded {len(records)} historical records.")


def _seed_admin_user(db):
    """Create the primary super administrator user and default profile if they don't exist yet."""
    super_email = settings.SUPER_ADMIN_EMAIL
    user = db.query(User).filter(User.email == super_email).first()

    # Also check legacy typo email if present
    if not user:
        legacy_user = db.query(User).filter(User.email == "vankatvamsi07@gmail.com").first()
        if legacy_user:
            legacy_user.email = super_email
            legacy_user.role = "super_admin"
            legacy_user.status = "active"
            user = legacy_user

    if not user:
        user = User(
            name=settings.SUPER_ADMIN_NAME,
            email=super_email,
            password_hash=hash_password(settings.SUPER_ADMIN_PASSWORD),
            role="super_admin",
            status="active",
        )
        db.add(user)
        db.flush()
        print(f"  👤 Super Admin user created: {super_email}")
    else:
        # Ensure role and status are set correctly
        user.role = "super_admin"
        user.status = "active"
        db.flush()

    if user and not db.query(UserProfile).filter(UserProfile.user_id == user.id).first():
        default_loc = db.query(Location).first()
        profile = UserProfile(
            user_id=user.id,
            age_group="18-44",
            vulnerability_category="General Population",
            activity_level="Mostly Indoor",
            water_access="Always available",
            heat_sensitivity="No",
            default_location_id=default_loc.id if default_loc else None,
            alert_threshold="High and Extreme",
            alerts_enabled=True,
        )
        db.add(profile)
        print(f"  📋 Seeded default heat-health profile for {user.email}")


if __name__ == "__main__":
    init_db()
