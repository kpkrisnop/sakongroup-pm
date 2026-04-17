import os
import json
import math
import sqlite3
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.responses import FileResponse
import paho.mqtt.client as mqtt
from dotenv import load_dotenv

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

load_dotenv()

# --- Configuration ---
MQTT_BROKER = os.getenv("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_USER = os.getenv("MQTT_USER")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD")
MQTT_TOPIC = os.getenv("MQTT_TOPIC_PM25", "homeassistant/sensor/+/state")
DB_PATH = os.getenv("DB_PATH", "pm25.db")
WRITE_INTERVAL = 60  # seconds — downsample to at most 1 write per sensor per minute
WAQI_TOKEN = os.getenv("WAQI_TOKEN")
WAQI_BOUNDS = "17.10,104.08,17.22,104.18"
WAQI_POLL_INTERVAL = 900  # 15 minutes

# --- Sensor Registry ---
# sensors.json defines sensor IDs (matching the MQTT topic segment), names, and locations.
# Only sensors listed here will be recorded; all others are silently ignored.
_sensors_path = os.path.join(os.path.dirname(__file__), "sensors.json")
with open(_sensors_path) as f:
    SENSORS: dict[str, dict] = {s["id"]: s for s in json.load(f)}

WAQI_UID_TO_ID: dict[int, str] = {
    s["waqi_uid"]: s["id"]
    for s in SENSORS.values()
    if "waqi_uid" in s
}

# --- Database ---
db_lock = threading.Lock()

def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS readings (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                sensor_id TEXT    NOT NULL,
                value     REAL    NOT NULL,
                timestamp TEXT    NOT NULL
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_sensor_time ON readings(sensor_id, timestamp)"
        )
        conn.commit()

def write_reading(sensor_id: str, value: float, ts: str):
    with db_lock:
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute(
                "INSERT INTO readings (sensor_id, value, timestamp) VALUES (?, ?, ?)",
                (sensor_id, value, ts),
            )
            conn.commit()

# --- In-Memory Latest Cache (for fast /api/pm25 reads) ---
latest_data: dict[str, dict] = {}

# Tracks last DB write time per sensor for downsampling
last_written: dict[str, float] = {}

# --- MQTT ---
def on_connect(client, userdata, flags, rc):
    print(f"Connected to MQTT Broker with result code {rc}")
    client.subscribe(MQTT_TOPIC)

def on_message(client, userdata, msg):
    try:
        # Topic format: homeassistant/sensor/<sensor_id>/state
        parts = msg.topic.split("/")
        if len(parts) < 3:
            return
        sensor_id = parts[2]

        if sensor_id not in SENSORS:
            return  # Ignore sensors not in registry

        value = float(msg.payload.decode().strip())
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        # Always update in-memory cache
        latest_data[sensor_id] = {"value": value, "last_updated": ts}

        # Write to DB at most once per minute per sensor
        now = time.monotonic()
        if now - last_written.get(sensor_id, 0) >= WRITE_INTERVAL:
            write_reading(sensor_id, value, ts)
            last_written[sensor_id] = now

    except (ValueError, IndexError) as e:
        print(f"Error processing message on {msg.topic}: {e}")

def run_mqtt():
    client = mqtt.Client()
    if MQTT_USER and MQTT_PASSWORD:
        client.username_pw_set(MQTT_USER, MQTT_PASSWORD)
    client.on_connect = on_connect
    client.on_message = on_message
    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_forever()
    except Exception as e:
        print(f"MQTT Connection Error: {e}")

def run_waqi_poller():
    import urllib.request
    import urllib.parse
    if not WAQI_TOKEN:
        print("INFO: WAQI_TOKEN not set — WAQI poller disabled")
        return
    url = (
        "https://api.waqi.info/v2/map/bounds?"
        + urllib.parse.urlencode({"latlng": WAQI_BOUNDS, "networks": "all", "token": WAQI_TOKEN})
    )
    while True:
        try:
            with urllib.request.urlopen(url, timeout=10) as resp:
                body = json.loads(resp.read())
            if body.get("status") == "ok":
                ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
                now = time.monotonic()
                for station in body["data"]:
                    sensor_id = WAQI_UID_TO_ID.get(station["uid"])
                    if not sensor_id or station["aqi"] in ("-", ""):
                        continue
                    value = float(station["aqi"])
                    latest_data[sensor_id] = {"value": value, "last_updated": ts}
                    if now - last_written.get(sensor_id, 0) >= WRITE_INTERVAL:
                        write_reading(sensor_id, value, ts)
                        last_written[sensor_id] = now
        except Exception as e:
            print(f"WAQI poller error: {e}")
        time.sleep(WAQI_POLL_INTERVAL)


# --- Startup ---
init_db()
mqtt_thread = threading.Thread(target=run_mqtt, daemon=True)
mqtt_thread.start()
waqi_thread = threading.Thread(target=run_waqi_poller, daemon=True)
waqi_thread.start()

# --- Helpers ---
def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))

# --- API ---
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Public PM2.5 API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.get("/api/pm25")
@limiter.limit("60/minute")
async def get_pm25(request: Request):
    """Returns the latest PM2.5 reading for every registered sensor, with location."""
    result = []
    for sensor_id, sensor_info in SENSORS.items():
        data = latest_data.get(sensor_id, {})
        result.append({
            "sensor_id": sensor_id,
            "name": sensor_info["name"],
            "latitude": sensor_info["latitude"],
            "longitude": sensor_info["longitude"],
            "value": data.get("value"),
            "unit": "µg/m³",
            "last_updated": data.get("last_updated"),
        })
    return result


@app.get("/api/pm25/nearest")
@limiter.limit("60/minute")
async def get_nearest(
    request: Request,
    lat: float = Query(..., description="Latitude of querying device"),
    lng: float = Query(..., description="Longitude of querying device"),
):
    """Returns the nearest sensor to the given coordinates with its latest reading."""
    if not SENSORS:
        raise HTTPException(status_code=404, detail="No sensors registered")

    nearest = min(
        SENSORS.values(),
        key=lambda s: haversine_km(lat, lng, s["latitude"], s["longitude"])
    )
    sensor_id = nearest["id"]
    data = latest_data.get(sensor_id, {})
    dist = haversine_km(lat, lng, nearest["latitude"], nearest["longitude"])

    return {
        "sensor_id": sensor_id,
        "name": nearest["name"],
        "latitude": nearest["latitude"],
        "longitude": nearest["longitude"],
        "value": data.get("value"),
        "unit": "µg/m³",
        "last_updated": data.get("last_updated"),
        "distance_km": round(dist, 3),
    }


@app.get("/api/pm25/history")
@limiter.limit("30/minute")
async def get_pm25_history(
    request: Request,
    start: str = Query(..., description="Start of range, e.g. 2026-04-01 or 2026-04-01T00:00:00Z"),
    end: str = Query(..., description="End of range, e.g. 2026-04-10 or 2026-04-10T23:59:59Z"),
    sensor_id: Optional[str] = Query(None, description="Filter by sensor ID (omit for all sensors)"),
    limit: int = Query(1000, ge=1, le=5000, description="Max records to return"),
):
    """Returns historical PM2.5 readings within a time range.

    Example: /api/pm25/history?start=2026-04-01&end=2026-04-10&sensor_id=pm25_living_room
    """
    with db_lock:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            if sensor_id:
                rows = conn.execute(
                    "SELECT sensor_id, value, timestamp FROM readings "
                    "WHERE sensor_id = ? AND timestamp >= ? AND timestamp <= ? "
                    "ORDER BY timestamp ASC LIMIT ?",
                    (sensor_id, start, end, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT sensor_id, value, timestamp FROM readings "
                    "WHERE timestamp >= ? AND timestamp <= ? "
                    "ORDER BY timestamp ASC LIMIT ?",
                    (start, end, limit),
                ).fetchall()

    result = []
    for row in rows:
        info = SENSORS.get(row["sensor_id"], {})
        result.append({
            "sensor_id": row["sensor_id"],
            "name": info.get("name"),
            "latitude": info.get("latitude"),
            "longitude": info.get("longitude"),
            "value": row["value"],
            "unit": "µg/m³",
            "timestamp": row["timestamp"],
        })
    return result


# --- Static Frontend ---
_DIST = Path(__file__).parent.parent / "frontend" / "dist"

if _DIST.is_dir():
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        target = _DIST / full_path
        if target.is_file():
            return FileResponse(target)
        return FileResponse(_DIST / "index.html")
else:
    print("INFO: frontend/dist not found — run 'npm run build' in frontend/ to enable the UI.")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
