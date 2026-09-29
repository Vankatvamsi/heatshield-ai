"""
HeatShield AI – Historical Analysis API Router
GET /api/history?city=Hyderabad&start=2023-01-01&end=2023-12-31
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.models import HistoricalRecord, Location
from app.database.session import get_db

router = APIRouter(prefix="/api/history", tags=["history"])


@router.get("")
def historical_data(
    city: str = Query("Hyderabad"),
    start: str = Query(None, description="ISO date YYYY-MM-DD"),
    end: str = Query(None, description="ISO date YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    loc = db.query(Location).filter(Location.city == city).first()
    if not loc:
        return {"status": "error", "message": f"City '{city}' not found", "data": []}

    q = db.query(HistoricalRecord).filter(HistoricalRecord.location_id == loc.id)
    if start:
        q = q.filter(HistoricalRecord.date >= start)
    if end:
        q = q.filter(HistoricalRecord.date <= end)

    records = q.order_by(HistoricalRecord.date).all()

    return {
        "status": "ok",
        "city": city,
        "count": len(records),
        "data": [
            {
                "date": r.date,
                "max_temperature": r.max_temperature,
                "min_temperature": r.min_temperature,
                "humidity": r.humidity,
                "heatwave": r.heatwave_label,
            }
            for r in records
        ],
    }


@router.get("/summary")
def historical_summary(city: str = Query("Hyderabad"), db: Session = Depends(get_db)):
    loc = db.query(Location).filter(Location.city == city).first()
    if not loc:
        return {"status": "error", "message": f"City '{city}' not found"}

    records = db.query(HistoricalRecord).filter(HistoricalRecord.location_id == loc.id).all()
    if not records:
        return {"status": "error", "message": "No historical data"}

    temps = [r.max_temperature for r in records if r.max_temperature]
    heatwave_days = sum(1 for r in records if r.heatwave_label == 1)

    return {
        "status": "ok",
        "city": city,
        "total_records": len(records),
        "heatwave_days": heatwave_days,
        "heatwave_percentage": round(heatwave_days / len(records) * 100, 1),
        "max_temp_recorded": round(max(temps), 1) if temps else None,
        "avg_max_temp": round(sum(temps) / len(temps), 1) if temps else None,
    }
