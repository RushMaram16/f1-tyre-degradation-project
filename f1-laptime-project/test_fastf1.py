import fastf1
import os

# Create cache folder if it doesn't exist
os.makedirs("cache", exist_ok=True)
fastf1.Cache.enable_cache("cache")

# Load a real F1 session
session = fastf1.get_session(2024, "Monza", "R")
session.load()

# Get lap data
laps = session.laps

# Save to CSV
laps.to_csv("monza_race_laps.csv", index=False)

print("Saved dataset to monza_race_laps.csv")

