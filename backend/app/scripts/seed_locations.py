"""Remove all locations with id > 10 and their dependent records."""
from sqlalchemy import text
from app.database.session import SessionLocal
from app.database.models import Location

db = SessionLocal()

# Delete dependent records first (cascade manually)
tables_to_clean = [
    "weather_data",
    "predictions",
    "thermal_stress",
    "uhi_data",
    "alerts",
    "historical_records",
    "personal_risk_assessments",
]

for table in tables_to_clean:
    result = db.execute(text(f"DELETE FROM {table} WHERE location_id > 10"))
    print(f"  Cleaned {table}: {result.rowcount} rows deleted")

# Now delete the extra locations
result = db.execute(text("DELETE FROM locations WHERE id > 10"))
print(f"\nDeleted {result.rowcount} extra locations")

db.commit()

# Verify
total = db.execute(text("SELECT COUNT(*) FROM locations")).scalar()
print(f"Remaining locations: {total}")

# Show what's left
rows = db.execute(text("SELECT id, name, state FROM locations ORDER BY id")).fetchall()
for r in rows:
    print(f"  {r[0]}: {r[1]} ({r[2]})")

db.close()
