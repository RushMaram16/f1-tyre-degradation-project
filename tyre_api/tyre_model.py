from typing import Dict, Any, List, Optional

# Track stress index (higher = more wear)
# (Singapore removed as you requested)
track_stress_index = {
    "Monaco": 1.4,
    "Silverstone": 1.2,
    "Monza": 0.9,
}

def website_predict(
    track: str,
    compound: str,
    lap_time: float,
    fuel_level: float,
    track_temp: Optional[float] = None,
    air_temp: Optional[float] = None,
    humidity: Optional[float] = None,
    lap_number: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Rule-based tyre-life predictor for the website.

    Returns:
      - life_laps
      - pit_start, pit_end, pit_window
      - wear_multiplier
      - health_curve (lap -> health)
      - lap_time_curve (lap -> lap_time_pred)
    """

    # ---------- Normalize / safe parsing ----------
    track = (track or "").title()
    compound_raw = (compound or "").strip()
    compound_key = compound_raw.upper()  # used internally

    lap_time = float(lap_time)
    fuel_level = float(fuel_level)

    track_temp_v = float(track_temp) if track_temp is not None else 35.0
    air_temp_v = float(air_temp) if air_temp is not None else 25.0
    humidity_v = float(humidity) if humidity is not None else 50.0
    lap_number_v = int(lap_number) if lap_number is not None else None

    # ---------- Base tyre life by compound ----------
    # You can tune these later.
    base_life = {
        "SOFT": 35,
        "MEDIUM": 45,
        "HARD": 60,
        "INTER": 40,   # Intermediate
        "WET": 50,     # Full wet
    }.get(compound_key, 45)

    # ---------- Weather logic (simple but realistic-ish) ----------
    # Wet tyres overheat on hot/dry track -> shorter life
    if compound_key in ("INTER", "WET") and track_temp_v > 35:
        base_life *= 0.75

    # Slicks struggle in very wet conditions (simulate rain/high humidity)
    if compound_key in ("SOFT", "MEDIUM", "HARD") and humidity_v > 75:
        base_life *= 0.80

    # Keep base_life reasonable
    base_life = max(10, float(base_life))

    # ---------- Wear multiplier components ----------
    # Fuel effect (heavier car => more wear): up to +25% at full fuel
    fuel_factor = 1.0 + (fuel_level / 100.0) * 0.25

    # Pace effect (faster lap => more stress): reference 75s
    # Faster than 75 => increases wear (capped a bit)
    pace_factor = 1.0 + max(0.0, (75.0 - lap_time) / 75.0) * 0.30

    # Track effect using stress index (default 1.0)
    track_factor = float(track_stress_index.get(track, 1.0))

    # Environment effect (tiny): hotter track => slightly more wear
    env_factor = 1.0 + max(0.0, (track_temp_v - 30.0)) * 0.003

    wear_multiplier = fuel_factor * pace_factor * track_factor * env_factor

    # ---------- Life in laps (more wear => less life) ----------
    life_laps = max(10, int(base_life / wear_multiplier))

    # ---------- Pit window near end of life ----------
    pit_start = max(1, int(life_laps * 0.70))
    pit_end = max(pit_start + 1, int(life_laps * 0.90))

    # ---------- Health curve: 1.0 -> 0.2 ----------
    health_curve: List[Dict[str, float]] = []
    for lap in range(1, life_laps + 1):
        # Linear-ish drop, clamped at 0.2
        health = max(0.2, 1.0 - (lap / life_laps) * 0.8)
        health_curve.append({"lap": float(lap), "health": round(float(health), 3)})

    # ---------- Lap time degradation curve ----------
    # Base compound degradation multiplier
    # (Higher = more lap time penalty growth)
    compound_deg = {
        "SOFT": 1.15,
        "MEDIUM": 1.00,
        "HARD": 0.85,
        "INTER": 0.95,
        "WET": 0.90,
    }.get(compound_key, 1.0)

    # Total added seconds by end of stint (simple + realistic-looking)
    # We scale by wear_multiplier and compound_deg
    end_delta = max(1.0, min(6.0, 2.5 * wear_multiplier * compound_deg))

    # Wet tyres are generally slower on dry track (optional realism)
    # This adds a baseline pace penalty when track is hot/dry.
    base_wet_penalty = 0.0
    if compound_key == "INTER":
        # slight penalty on dry
        base_wet_penalty = 0.6 if track_temp_v > 30 and humidity_v < 70 else 0.2
    if compound_key == "WET":
        base_wet_penalty = 1.2 if track_temp_v > 28 and humidity_v < 75 else 0.4

    lap_time_curve: List[Dict[str, float]] = []
    for item in health_curve:
        lap = int(item["lap"])
        health = float(item["health"])

        # progress 0..1
        progress = (lap - 1) / max(1, (life_laps - 1))

        # more penalty as health is lower
        penalty = end_delta * progress * (1.0 + (1.0 - health))

        pred = lap_time + base_wet_penalty + penalty
        lap_time_curve.append({"lap": float(lap), "lap_time": round(float(pred), 3)})

    return {
        "track": track,
        "compound": compound_key.title(),   # shows "Soft" / "Inter" / "Wet" etc
        "life_laps": life_laps,

        # ✅ pit window fields for frontend
        "pit_start": pit_start,
        "pit_end": pit_end,
        "pit_window": f"{pit_start} - {pit_end}",

        "wear_multiplier": round(wear_multiplier, 3),
        "health_curve": health_curve,
        "lap_time_curve": lap_time_curve,

        # Optional: helps debugging (frontend can ignore)
        "inputs_used": {
            "lap_time": lap_time,
            "fuel_level": fuel_level,
            "track_temp": track_temp_v,
            "air_temp": air_temp_v,
            "humidity": humidity_v,
            "lap_number": lap_number_v,
        }
    }

