"""
HeatShield AI – Vulnerable Population Risk Engine
Adjusts risk level and recommendations based on population category
and current heat/thermal stress conditions.

DISCLAIMER: Recommendations are public-health safety guidelines only.
This is NOT a medical diagnostic tool.
"""
from typing import Tuple


CATEGORIES = {
    "general": "General Population",
    "children": "Children (< 12 years)",
    "elderly": "Elderly (> 65 years)",
    "outdoor_worker": "Outdoor Workers",
    "athlete": "Athletes / Outdoor Exercisers",
}

# Risk multiplier relative to general population
SENSITIVITY_MULTIPLIER = {
    "general": 1.0,
    "children": 1.4,
    "elderly": 1.5,
    "outdoor_worker": 1.6,
    "athlete": 1.3,
}

RISK_LEVELS = ["LOW", "MODERATE", "HIGH", "EXTREME"]

RECOMMENDATIONS = {
    "general": {
        "LOW": "Conditions are safe. Stay hydrated and use sun protection when outdoors.",
        "MODERATE": "Moderate heat risk. Drink plenty of water and avoid peak sun hours (12–4 PM).",
        "HIGH": "High heat risk. Limit outdoor activities, stay in cool environments, and check on neighbours.",
        "EXTREME": "Extreme heat risk. Avoid all unnecessary outdoor exposure. Seek air-conditioned spaces immediately.",
    },
    "children": {
        "LOW": "Safe conditions. Keep children hydrated with cool water and use sun hats.",
        "MODERATE": "Moderate risk for children. Reduce outdoor play during midday and ensure regular water intake.",
        "HIGH": "High risk for children. Keep children indoors during peak heat hours and monitor for signs of heat exhaustion.",
        "EXTREME": "EXTREME RISK for children. Do not allow outdoor activity. Ensure cool environment and immediate medical help if heat illness is suspected.",
    },
    "elderly": {
        "LOW": "Conditions are manageable. Stay hydrated and rest in cool areas as needed.",
        "MODERATE": "Moderate risk for elderly individuals. Drink water regularly and avoid direct sun exposure.",
        "HIGH": "High risk. Remain in a cool environment and avoid unnecessary outdoor exposure. Check on elderly family members frequently.",
        "EXTREME": "EXTREME RISK for elderly. Stay in air-conditioned space. Seek medical attention if dizziness, confusion, or fatigue occurs.",
    },
    "outdoor_worker": {
        "LOW": "Normal work conditions. Stay hydrated and take shade breaks every hour.",
        "MODERATE": "Moderate heat risk for outdoor workers. Increase water intake and schedule heavy tasks for early morning.",
        "HIGH": "High risk for outdoor workers. Implement mandatory rest/shade breaks every 30 minutes. Buddy system recommended.",
        "EXTREME": "EXTREME RISK. Avoid prolonged outdoor work during peak heat (11 AM – 4 PM). Take frequent cooling breaks. Stop work if symptoms of heat stroke appear.",
    },
    "athlete": {
        "LOW": "Safe for moderate training. Stay hydrated pre, during, and post exercise.",
        "MODERATE": "Reduce training intensity and duration. Avoid midday outdoor sessions. Monitor body temperature.",
        "HIGH": "High risk for athletes. Postpone intense outdoor training sessions. Train only in early morning or evening with medical support on standby.",
        "EXTREME": "EXTREME RISK for athletes. Cancel all outdoor training. Risk of heat stroke is very high at this intensity level.",
    },
}


def assess_vulnerable_risk(
    base_risk: str,
    category: str,
    heatwave_probability: float,
    thermal_stress_score: float,
    temperature: float,
) -> dict:
    """
    Assess adjusted risk and recommendations for a vulnerable population category.

    Parameters
    ----------
    base_risk            : Overall risk from risk_engine ("LOW"|"MODERATE"|"HIGH"|"EXTREME")
    category             : Population category key (see CATEGORIES)
    heatwave_probability : float 0-100
    thermal_stress_score : float 0-100
    temperature          : float °C

    Returns
    -------
    dict with adjusted_risk, category_label, recommendation, signs_to_watch
    """
    if category not in CATEGORIES:
        category = "general"

    base_idx = RISK_LEVELS.index(base_risk)
    multiplier = SENSITIVITY_MULTIPLIER.get(category, 1.0)

    # Bump up risk level based on sensitivity multiplier
    adjusted_idx = min(3, int(base_idx * multiplier + 0.5))
    # Ensure we don't go below base
    adjusted_idx = max(adjusted_idx, base_idx)

    adjusted_risk = RISK_LEVELS[adjusted_idx]
    recommendation = RECOMMENDATIONS.get(category, RECOMMENDATIONS["general"]).get(adjusted_risk, "")

    signs_to_watch = _signs_to_watch(adjusted_risk)

    return {
        "category": category,
        "category_label": CATEGORIES[category],
        "base_risk": base_risk,
        "adjusted_risk": adjusted_risk,
        "recommendation": recommendation,
        "signs_to_watch": signs_to_watch,
        "context": {
            "heatwave_probability": heatwave_probability,
            "thermal_stress_score": thermal_stress_score,
            "temperature": temperature,
        },
        "disclaimer": (
            "These are public-health safety guidelines only. "
            "This system is NOT a medical diagnostic tool. "
            "Consult a healthcare professional if you experience heat-related symptoms."
        ),
    }


def _signs_to_watch(risk: str) -> list[str]:
    common = ["Heavy sweating", "Muscle cramps", "Fatigue or weakness"]
    if risk in ("LOW", "MODERATE"):
        return common
    if risk == "HIGH":
        return common + ["Headache", "Nausea", "Dizziness", "Cool/pale/moist skin (heat exhaustion)"]
    # EXTREME
    return common + [
        "Headache and confusion",
        "Hot, dry or damp skin (heat stroke sign)",
        "Rapid heartbeat",
        "Loss of consciousness",
        "Seek emergency medical help immediately for heat stroke.",
    ]
