"""
HeatShield AI – Heat-Safe Route Planner Service (Feature 10)
============================================================
Architecture:
  1. START + DESTINATION coordinates
  2. OpenStreetMap OSRM Routing API (road paths & alternatives with GeoJSON)
  3. Route segmentation with representative sampling (midpoints)
  4. Live or forecast weather retrieval via Open-Meteo per segment
  5. Segment-level Steadman Human Thermal Stress + ML Heatwave + Personal Risk calculation
  6. Multi-route comparative analysis & lower heat-exposure recommendation
  7. Journey monitoring, route deviation detection, and arrival health check
"""
import logging
import math
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.database.models import (
    Alert, Journey, JourneyHealthFeedback, Location, RouteRiskSegment,
    User, UserHealthSensitivity, UserProfile
)
from app.ml.predict import predict_heatwave
from app.services.personal_risk_engine import calculate_personal_risk
from app.services.thermal_stress import thermal_stress_score
from app.services.weather_service import (
    WeatherUnavailableError, get_current_weather, get_forecast
)

logger = logging.getLogger("heatshield.route_planner")

# OSRM Public Routing Endpoint
OSRM_BASE_URL = "https://router.project-osrm.org/route/v1/driving"
TIMEOUT_SECONDS = 12

# In-memory short-term weather cache for route points: (lat_round, lon_round, hour_str) -> data
_ROUTE_WEATHER_CACHE: Dict[str, Tuple[float, dict]] = {}
ROUTE_WEATHER_CACHE_TTL = 300.0  # 5 minutes cache per 0.05-degree grid point

# Distance threshold to trigger route deviation (meters)
ROUTE_DEVIATION_THRESHOLD_METERS = 400.0
DESTINATION_ARRIVAL_RADIUS_METERS = 200.0


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two geographic coordinates in meters."""
    R = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = (math.sin(dphi / 2.0) ** 2) + math.cos(phi1) * math.cos(phi2) * (math.sin(dlam / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))
    return R * c


def _get_osrm_routes(
    start_lat: float, start_lon: float,
    dest_lat: float, dest_lon: float
) -> List[dict]:
    """
    Fetch road route alternatives from OSRM.
    Returns list of route objects containing geometry (GeoJSON coordinates), distance, duration.
    """
    url = f"{OSRM_BASE_URL}/{start_lon},{start_lat};{dest_lon},{dest_lat}"
    params = {
        "overview": "full",
        "geometries": "geojson",
        "alternatives": "true",
        "steps": "false",
    }

    try:
        with httpx.Client(timeout=TIMEOUT_SECONDS) as client:
            resp = client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            if data.get("code") == "Ok" and data.get("routes"):
                return data["routes"]
    except Exception as e:
        logger.warning(f"OSRM routing API call failed ({e}). Generating geodesic segment path.")

    # Fallback if OSRM is unreachable: synthesize a direct roadway corridor
    steps = 6
    coords = []
    for i in range(steps + 1):
        frac = i / steps
        lat = start_lat + frac * (dest_lat - start_lat)
        lon = start_lon + frac * (dest_lon - start_lon)
        coords.append([lon, lat])

    dist = haversine_distance_meters(start_lat, start_lon, dest_lat, dest_lon) * 1.3  # road detour approx
    duration = dist / 11.1  # approx 40 km/h in urban India

    return [{
        "distance": dist,
        "duration": duration,
        "geometry": {
            "type": "LineString",
            "coordinates": coords,
        },
        "legs": [{"summary": "Direct Road Corridor"}],
    }]


def _segment_route(coordinates: List[List[float]], target_segments: int = 5) -> List[dict]:
    """
    Divides GeoJSON coordinates [[lon, lat], ...] into meaningful segments.
    For each segment, extracts sub-coordinates and calculates representative midpoint.
    """
    n_pts = len(coordinates)
    if n_pts < 2:
        return []

    # Calculate cumulative distance along path
    cum_dists = [0.0]
    for i in range(1, n_pts):
        d = haversine_distance_meters(
            coordinates[i - 1][1], coordinates[i - 1][0],
            coordinates[i][1], coordinates[i][0]
        )
        cum_dists.append(cum_dists[-1] + d)

    total_dist = cum_dists[-1]
    if total_dist <= 0:
        return [{
            "segment_index": 0,
            "coordinates": [[coordinates[0][1], coordinates[0][0]]],
            "midpoint": [coordinates[0][1], coordinates[0][0]],
            "distance_m": 0.0,
        }]

    # Determine segment count based on route length (min 3, max 8)
    num_segs = max(3, min(target_segments, 8))
    if total_dist < 3000:
        num_segs = max(2, min(4, num_segs))

    seg_length = total_dist / num_segs
    segments = []
    curr_start_idx = 0

    for s in range(num_segs):
        target_end_dist = (s + 1) * seg_length
        curr_end_idx = curr_start_idx + 1

        while curr_end_idx < n_pts - 1 and cum_dists[curr_end_idx] < target_end_dist:
            curr_end_idx += 1

        if s == num_segs - 1:
            curr_end_idx = n_pts - 1

        seg_coords_lonlat = coordinates[curr_start_idx : curr_end_idx + 1]
        if not seg_coords_lonlat:
            seg_coords_lonlat = [coordinates[curr_start_idx]]

        # Midpoint index for representative weather sampling
        mid_idx = curr_start_idx + (curr_end_idx - curr_start_idx) // 2
        mid_lon, mid_lat = coordinates[mid_idx]

        # Leaflet expects [lat, lon]
        leaflet_coords = [[pt[1], pt[0]] for pt in seg_coords_lonlat]
        seg_dist = cum_dists[curr_end_idx] - cum_dists[curr_start_idx]

        segments.append({
            "segment_index": s,
            "coordinates": leaflet_coords,
            "midpoint": [mid_lat, mid_lon],
            "distance_m": seg_dist,
        })

        curr_start_idx = curr_end_idx

    return segments


def _get_segment_weather(
    lat: float, lon: float,
    departure_time: Optional[str] = None
) -> dict:
    """
    Fetches weather for segment midpoint using Open-Meteo.
    Uses spatial & temporal in-memory caching to avoid excessive API requests.
    """
    cache_key = f"{round(lat, 2)}_{round(lon, 2)}_{departure_time or 'now'}"
    now_ts = time.time()

    if cache_key in _ROUTE_WEATHER_CACHE:
        cached_time, cached_data = _ROUTE_WEATHER_CACHE[cache_key]
        if (now_ts - cached_time) < ROUTE_WEATHER_CACHE_TTL:
            return cached_data

    # If departure time is specified in the future, attempt hourly forecast
    if departure_time and departure_time != "now":
        try:
            forecasts = get_forecast(city="", lat=lat, lon=lon)
            if forecasts:
                # Use nearest horizon
                w_data = forecasts[0]
                _ROUTE_WEATHER_CACHE[cache_key] = (now_ts, w_data)
                return w_data
        except Exception:
            pass

    # Default to current weather from Open-Meteo
    weather_data = get_current_weather(lat=lat, lon=lon, city="Route Segment")
    _ROUTE_WEATHER_CACHE[cache_key] = (now_ts, weather_data)
    return weather_data


def evaluate_road_route(
    route_raw: dict,
    route_index: int,
    user_profile: Optional[dict] = None,
    health_sensitivities: Optional[List[str]] = None,
    departure_time: Optional[str] = None,
) -> dict:
    """
    Evaluates heat risk along a road route geometry.
    Divides into segments, pulls Open-Meteo weather, and computes segment & overall scores.
    """
    coords_lonlat = route_raw["geometry"]["coordinates"]
    distance_meters = float(route_raw.get("distance", 0.0))
    duration_seconds = float(route_raw.get("duration", 0.0))

    segments = _segment_route(coords_lonlat, target_segments=5)
    evaluated_segments = []

    profile = user_profile or {}
    age_group = profile.get("age_group", "18-44")
    vuln_cat = profile.get("vulnerability_category", "General Population")
    activity = profile.get("activity_level", "Moderate Outdoor Activity")  # Travelling outdoors
    water = profile.get("water_access", "Always available")
    sensitivity = profile.get("heat_sensitivity", "No")

    total_personal_score = 0.0
    max_personal_score = 0.0
    total_ts_score = 0.0
    max_ts_score = 0.0
    high_risk_segment_count = 0

    now_utc = datetime.now(timezone.utc)

    for seg in segments:
        mid_lat, mid_lon = seg["midpoint"]
        try:
            weather = _get_segment_weather(mid_lat, mid_lon, departure_time=departure_time)
        except WeatherUnavailableError:
            weather = {
                "temperature": 32.0,
                "humidity": 55.0,
                "wind_speed": 10.0,
                "solar_radiation": 500.0,
                "pressure": 1013.0,
                "precipitation": 0.0,
                "dew_point": 20.0,
            }

        temp = weather.get("temperature", 30.0)
        hum = weather.get("humidity", 50.0)
        wind = weather.get("wind_speed", 10.0)
        solar = weather.get("solar_radiation", 500.0)
        pressure = weather.get("pressure", 1013.0)
        precipitation = weather.get("precipitation", 0.0)
        dew_point = weather.get("dew_point", 20.0)

        # 1. Thermal Stress
        ts_res = thermal_stress_score(temp_c=temp, humidity=hum, wind_speed=wind, solar_radiation=solar)
        seg_ts_score = ts_res["stress_score"]

        # 2. ML Heatwave Prediction
        features = {
            "temperature": temp,
            "max_temperature": temp + 3.0,
            "min_temperature": temp - 4.0,
            "humidity": hum,
            "wind_speed": wind,
            "solar_radiation": solar,
            "pressure": pressure,
            "precipitation": precipitation,
            "dew_point": dew_point,
            "latitude": mid_lat,
            "longitude": mid_lon,
            "day_of_year": now_utc.timetuple().tm_yday,
            "month": now_utc.month,
        }
        pred = predict_heatwave(features)
        hw_prob = pred["heatwave_probability"]

        # 3. Personal Risk calculation including health sensitivities
        risk_res = calculate_personal_risk(
            temperature=temp,
            humidity=hum,
            wind_speed=wind,
            solar_radiation=solar,
            heatwave_probability=hw_prob,
            age_group=age_group,
            vulnerability_category=vuln_cat,
            activity_level=activity,
            water_access=water,
            heat_sensitivity=sensitivity,
            health_sensitivities=health_sensitivities,
        )

        p_score = risk_res["personal_risk_score"]
        p_level = risk_res["personal_risk_level"]

        if p_level in ("HIGH", "EXTREME"):
            high_risk_segment_count += 1

        total_personal_score += p_score
        max_personal_score = max(max_personal_score, p_score)
        total_ts_score += seg_ts_score
        max_ts_score = max(max_ts_score, seg_ts_score)

        # Color mapping (🟢 Green, 🟡 Yellow, 🟠 Orange, 🔴 Red)
        if p_level == "EXTREME":
            color = "#ef4444"  # Red
            badge = "🔴 EXTREME"
        elif p_level == "HIGH":
            color = "#f97316"  # Orange
            badge = "🟠 HIGH"
        elif p_level == "MODERATE":
            color = "#eab308"  # Yellow
            badge = "🟡 MODERATE"
        else:
            color = "#10b981"  # Green
            badge = "🟢 LOW"

        evaluated_segments.append({
            "segment_index": seg["segment_index"],
            "coordinates": seg["coordinates"],
            "midpoint": seg["midpoint"],
            "distance_m": round(seg["distance_m"], 1),
            "temperature": round(temp, 1),
            "humidity": round(hum, 0),
            "wind_speed": round(wind, 1),
            "thermal_stress_score": round(seg_ts_score, 1),
            "thermal_stress_level": ts_res["category"],
            "heatwave_probability": round(hw_prob, 1),
            "personal_risk_score": p_score,
            "personal_risk_level": p_level,
            "risk_color": color,
            "risk_badge": badge,
            "main_factors": risk_res.get("main_risk_factors", []),
            "estimated_time": f"+{int(seg['distance_m'] / 11.1 / 60)} min",
        })

    num_segs = max(1, len(evaluated_segments))
    avg_personal_score = round(total_personal_score / num_segs, 1)
    avg_ts_score = round(total_ts_score / num_segs, 1)
    high_risk_pct = round((high_risk_segment_count / num_segs) * 100.0, 1)

    if avg_personal_score >= 75.0:
        overall_level = "EXTREME"
        overall_color = "#ef4444"
    elif avg_personal_score >= 50.0:
        overall_level = "HIGH"
        overall_color = "#f97316"
    elif avg_personal_score >= 25.0:
        overall_level = "MODERATE"
        overall_color = "#eab308"
    else:
        overall_level = "LOW"
        overall_color = "#10b981"

    # All coordinates for full route polyline
    all_leaflet_coords = [[pt[1], pt[0]] for pt in coords_lonlat]

    return {
        "route_index": route_index,
        "route_name": f"Route {chr(65 + route_index)}" if route_index < 26 else f"Route {route_index + 1}",
        "distance_km": round(distance_meters / 1000.0, 2),
        "duration_minutes": round(duration_seconds / 60.0, 0),
        "avg_personal_risk_score": avg_personal_score,
        "max_personal_risk_score": round(max_personal_score, 1),
        "overall_risk_level": overall_level,
        "overall_color": overall_color,
        "avg_thermal_stress_score": avg_ts_score,
        "max_thermal_stress_score": round(max_ts_score, 1),
        "high_risk_segment_percentage": high_risk_pct,
        "segments": evaluated_segments,
        "full_path_coordinates": all_leaflet_coords,
    }


def plan_heat_safe_routes(
    start_lat: float, start_lon: float, start_name: str,
    dest_lat: float, dest_lon: float, dest_name: str,
    user_profile: Optional[dict] = None,
    health_sensitivities: Optional[List[str]] = None,
    departure_time: Optional[str] = "now",
) -> Dict[str, Any]:
    """
    Main entry point to plan, analyze and rank road routes for heat exposure.
    """
    raw_routes = _get_osrm_routes(start_lat, start_lon, dest_lat, dest_lon)
    evaluated_routes = []

    for i, raw_r in enumerate(raw_routes):
        evaluated = evaluate_road_route(
            route_raw=raw_r,
            route_index=i,
            user_profile=user_profile,
            health_sensitivities=health_sensitivities,
            departure_time=departure_time,
        )
        evaluated_routes.append(evaluated)

    # Multi-route comparison: Choose route with lower heat-risk rather than shortest route
    # Composite score = (0.55 * avg_personal_risk) + (0.35 * max_personal_risk) + (0.10 * (distance_km / 10))
    best_idx = 0
    best_composite = float("inf")

    for i, r in enumerate(evaluated_routes):
        composite = (
            (0.55 * r["avg_personal_risk_score"]) +
            (0.35 * r["max_personal_risk_score"]) +
            (0.10 * r["distance_km"])
        )
        if composite < best_composite:
            best_composite = composite
            best_idx = i

    # Build recommendation explanation
    rec_route = evaluated_routes[best_idx]
    if len(evaluated_routes) > 1:
        other_routes = [r for idx, r in enumerate(evaluated_routes) if idx != best_idx]
        other_avg = sum(r["avg_personal_risk_score"] for r in other_routes) / len(other_routes)
        other_max = max(r["max_personal_risk_score"] for r in other_routes)

        reasons = []
        if rec_route["avg_personal_risk_score"] < other_avg:
            reasons.append(f"lower estimated average heat exposure ({rec_route['avg_personal_risk_score']}/100 vs {other_avg:.1f}/100)")
        if rec_route["max_personal_risk_score"] < other_max:
            reasons.append(f"lower peak thermal stress along the path (peak: {rec_route['max_personal_risk_score']:.0f}/100)")
        if rec_route["high_risk_segment_percentage"] == 0:
            reasons.append("zero high-risk or extreme heat exposure zones")

        reason_str = ", ".join(reasons) if reasons else "optimized heat exposure and route efficiency"
        rec_text = f"🛡️ Recommended: {rec_route['route_name']} provides {reason_str} based on current environmental conditions."
    else:
        rec_text = f"🛡️ Analyzed {rec_route['route_name']}: Estimated average heat risk is {rec_route['overall_risk_level']} ({rec_route['avg_personal_risk_score']}/100)."

    return {
        "start": {
            "name": start_name,
            "latitude": start_lat,
            "longitude": start_lon,
        },
        "destination": {
            "name": dest_name,
            "latitude": dest_lat,
            "longitude": dest_lon,
        },
        "departure_time": departure_time or "now",
        "recommended_route_index": best_idx,
        "recommendation_summary": rec_text,
        "total_routes_analyzed": len(evaluated_routes),
        "routes": evaluated_routes,
        "disclaimer": (
            "HeatShield AI provides comparative route heat exposure guidance based on environmental "
            "forecasts and profile parameters. It does not replace personal judgment or professional medical guidance."
        ),
    }


def find_active_route_segment(
    current_lat: float, current_lon: float,
    segments: List[dict]
) -> Tuple[Optional[int], float]:
    """
    Finds the closest route segment to the user's current GPS position
    and the minimum perpendicular distance to the route.
    """
    min_dist = float("inf")
    closest_seg_idx = None

    for seg in segments:
        coords = seg["coordinates"]  # [[lat, lon], ...]
        for pt in coords:
            d = haversine_distance_meters(current_lat, current_lon, pt[0], pt[1])
            if d < min_dist:
                min_dist = d
                closest_seg_idx = seg["segment_index"]

    return closest_seg_idx, min_dist