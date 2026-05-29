import os
import pandas as pd
import fastf1

# ----------------------------
# Setup caching
# ----------------------------
os.makedirs("cache", exist_ok=True)
fastf1.Cache.enable_cache("cache")

# ----------------------------
# Config
# ----------------------------
YEAR = 2024
TRACKS = ["Monza", "Monaco", "Silverstone"]
SESSIONS = ["Q", "R"]  # Quali + Race


def session_progress_label(lap_number, max_laps):
    """Split session into thirds: Early / Mid / Late."""
    if lap_number <= max_laps / 3:
        return "Early"
    elif lap_number <= 2 * max_laps / 3:
        return "Mid"
    else:
        return "Late"


def format_laptime(seconds: float) -> str:
    """Convert seconds -> M:SS.mmm"""
    minutes = int(seconds // 60)
    sec = seconds % 60
    return f"{minutes}:{sec:06.3f}"


all_rows = []

for track in TRACKS:
    for ses in SESSIONS:
        print(f"\nLoading: {YEAR} {track} {ses}")

        session = fastf1.get_session(YEAR, track, ses)
        session.load()

        laps = session.laps.copy()

        # ----------------------------
        # Keep only columns we care about
        # ----------------------------
        keep_cols = [
            "Driver", "Team", "LapNumber", "LapTime",
            "Compound", "Stint", "TrackStatus", "IsAccurate"
        ]
        laps = laps[keep_cols].dropna(subset=["LapTime"])

        # Convert LapTime -> seconds (ML target)
        laps["LapTimeSeconds"] = laps["LapTime"].dt.total_seconds()

        # Filter to accurate laps only
        laps = laps[laps["IsAccurate"] == True].copy()

        # Add context columns
        laps["Year"] = YEAR
        laps["Track"] = track
        laps["Session"] = ses

        # ----------------------------
        # (1) WEATHER FEATURES (session averages)
        # ----------------------------
        w = session.weather_data
        laps["AirTempC"] = float(w["AirTemp"].mean()) if "AirTemp" in w else None
        laps["TrackTempC"] = float(w["TrackTemp"].mean()) if "TrackTemp" in w else None
        laps["Rainfall"] = float(w["Rainfall"].mean()) if "Rainfall" in w else None

        # ----------------------------
        # (2) TYRE AGE (laps into current stint)
        # ----------------------------
        laps = laps.sort_values(["Driver", "LapNumber"])
        laps["TyreAgeLaps"] = laps.groupby(["Driver", "Stint"]).cumcount()

        # ----------------------------
        # (3) SESSION PROGRESS (Early/Mid/Late)
        # ----------------------------
        max_laps = laps["LapNumber"].max()
        laps["SessionProgress"] = laps["LapNumber"].apply(
            lambda x: session_progress_label(x, max_laps)
        )

        # ----------------------------
        # LapTime formatted (display only)
        # ----------------------------
        laps["LapTimeFormatted"] = laps["LapTimeSeconds"].apply(format_laptime)

        # ==========================================================
        # (4) ESTIMATED FUEL + CAR WEIGHT
        # ==========================================================
        BASE_CAR_MASS_NO_FUEL = 798.0  # kg (approx minimum mass without fuel)

        if ses == "R":
            fuel_start = 110.0  # kg (starting fuel assumption)
            race_laps = getattr(session, "total_laps", None)
            if not race_laps or race_laps <= 0:
                race_laps = int(laps["LapNumber"].max())

            fuel_per_lap = fuel_start / float(race_laps)

            # Lap 1 has full fuel, then decreases each lap
            laps["FuelKg"] = (fuel_start - fuel_per_lap * (laps["LapNumber"] - 1)).clip(lower=0)
        else:
            # Qualifying: assume small constant fuel
            laps["FuelKg"] = 10.0

        laps["EstimatedCarWeightKg"] = BASE_CAR_MASS_NO_FUEL + laps["FuelKg"]

        # ==========================================================
        # (5) ESTIMATED TYRE TEMPERATURE (proxy)
        # ==========================================================
        compound_map = {
            "SOFT": 8, "MEDIUM": 5, "HARD": 2,
            "INTERMEDIATE": 3, "WET": 1
        }
        laps["CompoundEffect"] = laps["Compound"].map(compound_map).fillna(4)

        # intensity proxy: faster than typical laps => more energy => hotter tyres
        med = laps["LapTimeSeconds"].median()
        iqr = (laps["LapTimeSeconds"].quantile(0.75) - laps["LapTimeSeconds"].quantile(0.25)) or 1.0
        laps["Intensity"] = ((med - laps["LapTimeSeconds"]) / iqr).clip(-1, 1)

        # tyre age effect, capped
        laps["TyreAgeEffect"] = (0.6 * laps["TyreAgeLaps"]).clip(0, 10)

        rain = laps["Rainfall"].fillna(0)

        laps["EstimatedTyreTempC"] = (
            laps["TrackTempC"].fillna(35)
            + laps["CompoundEffect"]
            + laps["TyreAgeEffect"]
            + 6.0 * laps["Intensity"]
            - 8.0 * rain
        )

        # Collect
        all_rows.append(laps)

# ----------------------------
# Combine and save
# ----------------------------
df = pd.concat(all_rows, ignore_index=True)

out_file = "laps_dataset_v3.csv"
df.to_csv(out_file, index=False)

print(f"\n✅ Saved dataset: {out_file}")
print(df[[
    "Track", "Session", "Driver", "LapNumber",
    "FuelKg", "EstimatedCarWeightKg", "EstimatedTyreTempC",
    "Compound", "TyreAgeLaps", "LapTimeFormatted"
]].head())
cd ~/Downloads
jupyter notebook tyre_model_v1_stable.ipynb
