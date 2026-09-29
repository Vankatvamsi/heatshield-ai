"""
HeatShield AI – Database Session
SQLAlchemy engine and session factory for PostgreSQL.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.utils.config import get_settings

settings = get_settings()

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,       # Verify connections before use
    pool_size=5,
    max_overflow=10,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """FastAPI dependency – yields a DB session and closes it on completion."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
