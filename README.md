# HeatShield AI — SIH26083
## Extreme Heatwave Early Warning & Human Thermal Stress Index System

[![Python](https://img.shields.io/badge/Python-3.11%2B-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111.0-009688.svg)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%2B-336791.svg)](https://www.postgresql.org)
[![Open-Meteo](https://img.shields.io/badge/Weather-Open--Meteo-0075FF.svg)](https://open-meteo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://reactjs.org)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF.svg)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC.svg)](https://tailwindcss.com)

---

## 🌟 Executive Summary

**HeatShield AI** is an operational, AI-powered extreme heatwave early warning system designed for SIH Problem Statement **SIH26083** (*"Extreme Heatwave Early Warning and Human Thermal Stress Index"*).

The platform continuously consumes **live weather streams from Open-Meteo**, evaluates heatwave risks using a supervised **Random Forest ML classifier**, computes **Human Thermal Stress (Steadman Heat Index)**, estimates **Urban Heat Island (UHI)** anomalies, adapts advisories for **5 vulnerable population cohorts**, generates **automated early alerts**, and persists all telemetry in **PostgreSQL**.

---

## 🚀 Key Architectural Features

1. **Live Weather Streaming (Open-Meteo API)**
   - No API key required.
   - Dynamic coordinate resolution for any global location via Open-Meteo Geocoding.
   - Fetches temperature, relative humidity, wind speed, surface pressure, precipitation, dew point, solar radiation, and hourly forecasts.
   - **Zero Demo Mode / Zero Fake Fallback**: Displays real-time metrics with honest availability messaging.

2. **Continuous Background Scheduler (APScheduler)**
   - Executes every **15 minutes** in the background.
   - Automatically polls live weather for all registered locations, runs ML inference, computes thermal stress, checks UHI deltas, evaluates alert triggers, and stores records in PostgreSQL.

3. **Machine Learning Heatwave Predictor**
   - Supervised **Random Forest Classifier** trained on meteorological anomalies, rolling statistics, dew points, and pressure gradients.
   - Outputs temporal heatwave probabilities (`0–100%`) and risk classifications (`LOW`, `MODERATE`, `HIGH`, `EXTREME`).

4. **Human Thermal Stress Index (0–100 HI Score)**
   - Standardized scientific calculation based on the Steadman Heat Index equation.
   - Incorporates ambient temperature, relative humidity, wind cooling attenuation, and solar radiation flux.

5. **Future Heatwave Prediction Timeline (+48 Hours)**
   - Dynamic projection across `+6h`, `+12h`, `+24h`, and `+48h` horizons using Open-Meteo hourly forecast vectors.

6. **Interactive Heat Risk Map (Leaflet / OpenStreetMap)**
   - Displays spatial heatwave risks, thermal stress scores, and meteorological observations across all tracked locations.

7. **Urban Heat Island (UHI) Microclimate Engine**
   - Evaluates urban vs. reference baseline thermal variations across land-cover profiles (CBD, Industrial, Residential, Green Canopies, etc.) and NDVI vegetation indices.

8. **Vulnerable Population Risk Advisor**
   - Dynamic cohort-specific sensitivity adjustments for:
     - **General Population** (`1.0x`)
     - **Children (< 12 yrs)** (`1.4x`)
     - **Elderly (> 65 yrs)** (`1.5x`)
     - **Outdoor Workers** (`1.6x`)
     - **Athletes / Exercisers** (`1.3x`)
   - Backend recalculates risk levels and public health safety protocols upon cohort selection.

9. **Automated Heatwave Alert Engine**
   - Auto-generates `INFO`, `WARNING`, `HIGH`, and `EXTREME` alert records with 6-hour deduplication windows stored directly in PostgreSQL.

---

## 🗄️ Database Architecture (PostgreSQL)

| Table | Purpose | Key Fields |
|---|---|---|
| `users` | System administrators and operators | `id`, `name`, `email`, `password_hash`, `default_location_id`, `created_at` |
| `locations` | Tracked cities and geographic coordinates | `id`, `name`, `latitude`, `longitude`, `city`, `state`, `country`, `timezone` |
| `weather_data` | Live meteorological records from Open-Meteo | `id`, `location_id`, `timestamp`, `temperature`, `humidity`, `wind_speed`, `pressure`, `solar_radiation`, `precipitation`, `dew_point`, `data_source` |
| `predictions` | ML heatwave inferences | `id`, `location_id`, `timestamp`, `heatwave_probability`, `risk_level`, `model_version`, `model_source` |
| `thermal_stress`| Calculated physiological indices | `id`, `location_id`, `timestamp`, `temperature`, `humidity`, `heat_index`, `thermal_stress_score`, `thermal_stress_level` |
| `uhi_data` | Urban microclimate calculations | `id`, `location_id`, `timestamp`, `urban_temperature`, `reference_temperature`, `uhi_intensity`, `uhi_level`, `land_cover` |
| `vulnerable_profiles` | Cohort preference configurations | `id`, `user_id`, `category`, `created_at` |
| `alerts` | Heatwave warnings and advisories | `id`, `location_id`, `alert_level`, `risk_level`, `message`, `temperature`, `heatwave_probability`, `thermal_stress_score`, `acknowledged` |
| `historical_records` | Multi-year training and baseline climate logs | `id`, `location_id`, `date`, `max_temperature`, `min_temperature`, `humidity`, `heatwave_label` |

---

## ⚙️ Setup & Installation Instructions

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ & npm
- PostgreSQL 14+ installed and running locally on port 5432
- pgAdmin 4 (optional GUI for inspection)

### 2. PostgreSQL Configuration
Ensure the `heatshield` database exists in PostgreSQL:
```sql
CREATE DATABASE heatshield;
```

### 3. Backend Setup
```bash
# Navigate to the backend directory
cd backend

# Activate virtual environment
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
# Copy .env.example to .env and adjust PostgreSQL credentials if needed
# Example DATABASE_URL:
# DATABASE_URL=postgresql+psycopg2://postgres:root@localhost:5432/heatshield

# Initialize tables and seed initial locations & historical records
python -m app.database.init_db

# Start FastAPI backend server
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
Backend API will be live at:
- **API Base**: `http://127.0.0.1:8000/api`
- **Interactive Swagger Docs**: `http://127.0.0.1:8000/docs`
- **Health Endpoint**: `http://127.0.0.1:8000/api/health`

### 4. Frontend Setup
```bash
# Open a new terminal and navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Start Vite React development server
npm run dev
```
Frontend Web Dashboard will be live at: `http://localhost:5173`

---

## 🔍 Verification & Testing Guide

### 1. Run Automated Pytest Suite
```bash
cd backend
pytest ../tests/ -v
```
*Executes all 19 integration tests validating Open-Meteo live API, geocoding search, PostgreSQL persistence, and ML predictions.*

### 2. Testing Dynamic Location Switching
1. Open dashboard at `http://localhost:5173`.
2. Switch location dropdown from **Hyderabad** to **Delhi**.
3. Verify that temperature, humidity, wind, and coordinates immediately update to Delhi's live observations.
4. Type any global city (e.g., *Tokyo*, *Mumbai*, *Jaipur*) in the top search bar to test dynamic Open-Meteo geocoding search and auto-persistence.

### 3. Testing Vulnerable Population Cohort Switching
1. Navigate to **Vulnerable Population** tab.
2. Toggle between **General Population** and **Outdoor Workers** / **Elderly**.
3. Verify that the backend immediately recalculates the adjusted risk severity and updates safety guidelines based on the sensitivity multiplier.

### 4. Verifying PostgreSQL Records in pgAdmin
1. Open **pgAdmin 4** and connect to your local PostgreSQL server.
2. Expand `Databases` → `heatshield` → `Schemas` → `public` → `Tables`.
3. Right click `weather_data` → `View/Edit Data` → `All Rows` to inspect live Open-Meteo records continuously saved by the background scheduler.
4. Check `predictions`, `thermal_stress`, and `alerts` tables for synchronized records.

---

## 🛡️ License & Compliance
Built for SIH26083. All environmental calculations use official Open-Meteo meteorological vectors. Medical and safety advisories follow public health heat-action plan conventions.
