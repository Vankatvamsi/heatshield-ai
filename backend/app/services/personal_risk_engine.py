"""
HeatShield AI – Personal Heat-Health Risk Engine
=================================================
Combines:
  1. Live environmental conditions (temperature, humidity, wind, solar radiation)
  2. Steadman Human Thermal Stress score
  3. Heatwave ML prediction probability
  4. User Profile (Age group, Vulnerability category, Activity level, Water access, Heat sensitivity)

DISCLAIMER:
  HeatShield AI provides general heat-risk and safety guidance based on
  environmental conditions and the information you provide. It is not a
  medical diagnostic system and does not replace professional medical advice.
"""
from typing import Any, Dict, List, Optional

from app.services.risk_engine import classify_risk
from app.services.thermal_stress import thermal_stress_score


MEDICAL_DISCLAIMER = (
    "HeatShield AI provides general heat-risk and safety guidance based on "
    "environmental conditions and the information you provide. It is not a "
    "medical diagnostic system and does not replace professional medical advice."
)


def calculate_personal_risk(
    temperature: float,
    humidity: float,
    wind_speed: float = 10.0,
    solar_radiation: float = 600.0,
    heatwave_probability: float = 0.0,
    age_group: str = "18-44",
    vulnerability_category: str = "General Population",
    activity_level: str = "Mostly Indoor",
    water_access: str = "Always available",
    heat_sensitivity: str = "No",
    health_sensitivities: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Computes dynamic personal risk from environmental signals, user profile,
    and optional health & heat sensitivity factors.
    """
    # 1. Thermal Stress Calculation
    ts_result = thermal_stress_score(
        temp_c=temperature,
        humidity=humidity,
        wind_speed=wind_speed,
        solar_radiation=solar_radiation,
    )
    ts_score = ts_result["stress_score"]
    ts_category = ts_result["category"]

    # 2. Environmental Risk Level
    env_risk = classify_risk(
        heatwave_probability=heatwave_probability,
        thermal_stress_score=ts_score,
        temperature=temperature,
    )

    # 3. Base Environmental Score (0 - 100)
    # Blend thermal stress (50%), heatwave probability (35%), and temp severity (15%)
    temp_severity = min(100.0, max(0.0, (temperature - 25.0) / (48.0 - 25.0) * 100.0))
    base_env_score = (0.50 * ts_score) + (0.35 * heatwave_probability) + (0.15 * temp_severity)

    # 4. User Profile Modifiers
    main_factors: List[str] = []
    profile_adjustment = 0.0

    # Age Group Adjustment
    norm_age = (age_group or "").strip().lower()
    if "under 5" in norm_age or "under_5" in norm_age:
        profile_adjustment += 14.0
        main_factors.append("Age vulnerability: Under 5 (immature thermoregulation & rapid hydration loss)")
    elif "65" in norm_age:
        profile_adjustment += 18.0
        main_factors.append("Age vulnerability: 65+ (diminished sweat gland response & cardiovascular strain)")
    elif "45" in norm_age:
        profile_adjustment += 6.0
    elif "5" in norm_age and "17" in norm_age:
        profile_adjustment += 5.0
        main_factors.append("Age sensitivity: Youth (5–17)")

    # Vulnerability Category Adjustment
    norm_vuln = (vulnerability_category or "").strip().lower()
    if "outdoor" in norm_vuln or "worker" in norm_vuln:
        profile_adjustment += 20.0
        main_factors.append("Vulnerability category: Outdoor Worker (direct sun exposure & extended heat shifts)")
    elif "elderly" in norm_vuln:
        profile_adjustment += 18.0
        if not any("65" in f for f in main_factors):
            main_factors.append("Vulnerability category: Elderly population")
    elif "child" in norm_vuln:
        profile_adjustment += 12.0
        if not any("Under 5" in f for f in main_factors):
            main_factors.append("Vulnerability category: Child")
    elif "athlete" in norm_vuln:
        profile_adjustment += 10.0
        main_factors.append("Vulnerability category: Athlete / High exertion")

    # Activity Level Adjustment
    norm_act = (activity_level or "").strip().lower()
    if "heavy" in norm_act:
        profile_adjustment += 22.0
        main_factors.append("Activity level: Heavy Physical Activity (maximum internal metabolic heat generation)")
    elif "moderate" in norm_act:
        profile_adjustment += 12.0
        main_factors.append("Activity level: Moderate Physical Activity outdoors")
    elif "light" in norm_act:
        profile_adjustment += 5.0
        main_factors.append("Activity level: Light Outdoor Activity")
    elif "indoor" in norm_act:
        profile_adjustment -= 8.0  # Indoor shelter mitigates direct heat

    # Water Access Adjustment
    norm_water = (water_access or "").strip().lower()
    if "unavailable" in norm_water:
        profile_adjustment += 16.0
        main_factors.append("Drinking water access: Usually unavailable (severe dehydration hazard)")
    elif "sometimes" in norm_water:
        profile_adjustment += 8.0
        main_factors.append("Drinking water access: Sometimes available (sub-optimal hydration)")

    # General Heat Sensitivity Flag
    norm_sens = (heat_sensitivity or "").strip().lower()
    if "yes" in norm_sens:
        profile_adjustment += 8.0
        main_factors.append("Reported personal heat-sensitivity")

    # Feature 11: Specific Health & Heat Sensitivity Conditions (Non-diagnostic safety adjustments)
    sens_list = [s for s in (health_sensitivities or []) if s and s not in ("None", "Prefer not to say")]
    if sens_list:
        sens_adj = 0.0
        for s in sens_list:
            s_lower = s.lower()
            if "cardiovascular" in s_lower or "heart" in s_lower:
                sens_adj = max(sens_adj, 14.0)
                main_factors.append("Health context: Cardiovascular condition (extra cardiac workload in heat)")
            elif "kidney" in s_lower:
                sens_adj = max(sens_adj, 14.0)
                main_factors.append("Health context: Kidney-related condition (elevated acute hydration vulnerability)")
            elif "migraine" in s_lower or "headache" in s_lower:
                sens_adj = max(sens_adj, 10.0)
                main_factors.append("Health context: Heat-triggered migraine/headaches (rapid glare/heat trigger)")
            elif "previous" in s_lower or "heat-related illness" in s_lower:
                sens_adj = max(sens_adj, 12.0)
                main_factors.append("Health context: Previous heat illness history (increased physiological susceptibility)")
            elif "respiratory" in s_lower:
                sens_adj = max(sens_adj, 10.0)
                main_factors.append("Health context: Respiratory condition (warm air and ozone sensitivity)")
            elif "diabetes" in s_lower:
                sens_adj = max(sens_adj, 10.0)
                main_factors.append("Health context: Diabetes (compromised thermoregulatory blood flow)")
            elif "heat sensitivity" in s_lower or "intolerance" in s_lower:
                sens_adj = max(sens_adj, 8.0)
                main_factors.append("Health context: Pronounced heat intolerance")
            elif "other" in s_lower:
                sens_adj = max(sens_adj, 6.0)
                main_factors.append("Health context: Personal health precaution noted")
        profile_adjustment += min(24.0, sens_adj + (len(sens_list) - 1) * 3.0)

    # Environmental factors explanation
    if temperature >= 40.0:
        main_factors.insert(0, f"Severe ambient heat ({temperature:.1f}°C)")
    elif temperature >= 35.0:
        main_factors.insert(0, f"High ambient temperature ({temperature:.1f}°C)")

    if humidity >= 60.0 and temperature >= 30.0:
        main_factors.append(f"High relative humidity ({humidity:.0f}%) reducing evaporative cooling")

    if ts_score >= 50.0:
        main_factors.append(f"Elevated Human Thermal Stress index ({ts_score:.0f}/100 – {ts_category})")

    if heatwave_probability >= 40.0:
        main_factors.append(f"High heatwave probability ({heatwave_probability:.0f}%) predicted by ML model")

    # 5. Calculate Final Personal Risk Score (0 - 100)
    raw_personal_score = base_env_score + profile_adjustment
    personal_risk_score = round(min(100.0, max(0.0, raw_personal_score)), 1)

    # 6. Determine Personal Risk Level
    if personal_risk_score >= 75.0:
        personal_risk_level = "EXTREME"
    elif personal_risk_score >= 50.0:
        personal_risk_level = "HIGH"
    elif personal_risk_score >= 25.0:
        personal_risk_level = "MODERATE"
    else:
        personal_risk_level = "LOW"

    # 7. "Can I Go Outside Now?" dynamic evaluation
    if personal_risk_score < 25.0 and env_risk == "LOW":
        can_go_out_code = "LOWER_RISK"
        can_go_out_badge = "🟢 LOWER RISK"
        can_go_out_title = "Lower Risk Conditions"
        can_go_out_message = "Conditions are currently lower risk for your profile. Maintain normal hydration."
    elif personal_risk_score < 50.0:
        can_go_out_code = "GO_WITH_CAUTION"
        can_go_out_badge = "🟡 GO WITH CAUTION"
        can_go_out_title = "Proceed With Caution"
        can_go_out_message = "Outdoor activity is possible with heat-safety precautions and adequate hydration."
    elif personal_risk_score < 75.0:
        can_go_out_code = "AVOID_IF_POSSIBLE"
        can_go_out_badge = "🟠 AVOID IF POSSIBLE"
        can_go_out_title = "Avoid Non-Essential Activity"
        can_go_out_message = "Consider postponing non-essential outdoor activity during peak daylight hours."
    else:
        can_go_out_code = "HIGH_RISK"
        can_go_out_badge = "🔴 HIGH RISK"
        can_go_out_title = "Dangerous Heat Exposure"
        can_go_out_message = "Avoid outdoor exposure unless strictly necessary. High risk of heat-related illness."

    # 8. Dynamic Precautions ("I MUST GO OUT")
    precautions = generate_precautions(
        personal_risk_level=personal_risk_level,
        temperature=temperature,
        vulnerability_category=vulnerability_category,
        activity_level=activity_level,
        water_access=water_access,
        age_group=age_group,
    )

    # 9. Recommendation summary
    if personal_risk_level == "EXTREME":
        recommendation = (
            "Extreme personal heat hazard detected. Stay in cool, well-ventilated or air-conditioned spaces. "
            "If outdoor travel is unavoidable, take frequent rest breaks in shade and drink cool water every 15 minutes."
        )
    elif personal_risk_level == "HIGH":
        recommendation = (
            "High heat-safety risk for your profile. Limit direct sunlight exposure, pace your physical activity, "
            "and ensure immediate access to drinking water and cool rest zones."
        )
    elif personal_risk_level == "MODERATE":
        recommendation = (
            "Moderate heat risk. Stay well hydrated, use sun protection (hats, lightweight clothing), "
            "and avoid prolonged exertion during peak afternoon hours."
        )
    else:
        recommendation = (
            "Conditions are comfortable and manageable for your profile. Maintain standard hydration while outdoors."
        )

    return {
        "environmental_risk": env_risk,
        "thermal_stress_score": ts_score,
        "thermal_stress_category": ts_category,
        "heat_index": ts_result["heat_index"],
        "heatwave_probability": heatwave_probability,
        "personal_risk_score": personal_risk_score,
        "personal_risk_level": personal_risk_level,
        "score_label": "HeatShield Personal Risk Score",
        "main_risk_factors": main_factors,
        "can_go_outside": {
            "code": can_go_out_code,
            "badge": can_go_out_badge,
            "title": can_go_out_title,
            "message": can_go_out_message,
        },
        "recommendation": recommendation,
        "precautions": precautions,
        "disclaimer": MEDICAL_DISCLAIMER,
        "profile_summary": {
            "age_group": age_group,
            "vulnerability_category": vulnerability_category,
            "activity_level": activity_level,
            "water_access": water_access,
            "heat_sensitivity": heat_sensitivity,
        },
    }


def generate_precautions(
    personal_risk_level: str,
    temperature: float,
    vulnerability_category: str,
    activity_level: str,
    water_access: str,
    age_group: str,
) -> List[Dict[str, str]]:
    """
    Generates personalized, structured heat-safety precautions.
    """
    items: List[Dict[str, str]] = []

    # 1. Hydration
    if "unavailable" in (water_access or "").lower() or "sometimes" in (water_access or "").lower():
        items.append({
            "category": "Hydration",
            "title": "Carry Sufficient Drinking Water",
            "detail": "Carry at least 1.5 to 2 litres of potable water with electrolytes before leaving. Do not rely on finding water on-site.",
        })
    else:
        items.append({
            "category": "Hydration",
            "title": "Continuous Hydration",
            "detail": "Drink 250–500 ml of cool water every 20–30 minutes, even if you do not feel thirsty.",
        })

    # 2. Timing and Solar Avoidance
    items.append({
        "category": "Exposure",
        "title": "Prefer Cooler Hours",
        "detail": "Reschedule outdoor tasks to early morning (before 10:00 AM) or evening (after 5:30 PM) whenever possible.",
    })

    # 3. Rest & Shade Breaks
    if "outdoor" in (vulnerability_category or "").lower() or "heavy" in (activity_level or "").lower():
        items.append({
            "category": "Rest Breaks",
            "title": "Frequent Mandatory Shade Breaks",
            "detail": "Take a 10–15 minute rest in dense shade or air-conditioned shelter after every 30 minutes of physical work.",
        })
    else:
        items.append({
            "category": "Rest Breaks",
            "title": "Rest in Shaded or Cool Areas",
            "detail": "Seek shade, trees, or air-conditioned facilities periodically to allow body core temperature recovery.",
        })

    # 4. Clothing & Protective Gear
    items.append({
        "category": "Attire",
        "title": "Wear Lightweight, Breathable Clothing",
        "detail": "Use loose-fitting, light-colored cotton or moisture-wicking fabrics, along with a wide-brimmed hat and UV sunglasses.",
    })

    # 5. Activity Moderation
    if "heavy" in (activity_level or "").lower() or "athlete" in (vulnerability_category or "").lower():
        items.append({
            "category": "Pacing",
            "title": "Reduce Strenuous Physical Exertion",
            "detail": "Lower the intensity and speed of work or workouts. Avoid maximal physical efforts during high ambient temperature periods.",
        })

    # 6. Age-specific guidance
    if "under 5" in (age_group or "").lower() or "child" in (vulnerability_category or "").lower():
        items.append({
            "category": "Vulnerable Care",
            "title": "Close Monitoring for Children",
            "detail": "Never leave children unattended in enclosed vehicles or direct sun. Keep them well hydrated and in breezy shade.",
        })
    elif "65" in (age_group or "").lower() or "elderly" in (vulnerability_category or "").lower():
        items.append({
            "category": "Vulnerable Care",
            "title": "Elderly Care & Buddy System",
            "detail": "Ensure companion contact or check-ins every hour. Move quickly between climate-controlled environments.",
        })

    # 7. Heat Illness Signs & Action
    items.append({
        "category": "Symptoms",
        "title": "Monitor for Early Heat Symptoms",
        "detail": "Watch for dizziness, headache, nausea, rapid pulse, or muscle cramping. If severe symptoms (confusion, fainting, cessation of sweat) appear, seek immediate medical care.",
    })

    return items
