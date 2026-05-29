from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from tyre_model import website_predict

app = FastAPI(title="Tyre Life API", version="1.0")

# Allow React (Vite) to call FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PredictRequest(BaseModel):
    track: str
    compound: str
    lap_time: float
    fuel_level: float

    # ✅ new params (React UI has these now)
    track_temp: float
    air_temp: float
    humidity: float
    lap_number: int

@app.get("/")
def root():
    return {"status": "ok", "message": "Tyre Life API is running"}

@app.post("/predict")
def predict(req: PredictRequest):
    result = website_predict(
        track=req.track,
        compound=req.compound,
        lap_time=req.lap_time,
        fuel_level=req.fuel_level,
        track_temp=req.track_temp,
        air_temp=req.air_temp,
        humidity=req.humidity,
        lap_number=req.lap_number,
    )
    return result

