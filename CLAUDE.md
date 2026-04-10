# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Public PM2.5 Air Quality API** — a Python backend that bridges a Home Assistant MQTT sensor to a public REST endpoint. It runs inside a Proxmox LXC container and is exposed via Cloudflare Tunnel.

## Commands

```bash
# Install dependencies
pip install -r backend/requirements.txt

# Run the server (development)
cd backend && python main.py

# Run with uvicorn directly (preferred)
cd backend && uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## Configuration

The app requires a `.env` file in `backend/` with these variables:

```
MQTT_BROKER=<host>
MQTT_PORT=1883
MQTT_USER=<username>
MQTT_PASSWORD=<password>
MQTT_TOPIC_PM25=homeassistant/sensor/+/state
DB_PATH=pm25.db          # optional, defaults to pm25.db in working dir
```

## Sensor Registry

Sensors are defined in [backend/sensors.json](backend/sensors.json). Each entry maps a sensor ID (the segment from the MQTT topic `homeassistant/sensor/<id>/state`) to a human-readable name and a fixed lat/lng for map display. Only sensors listed here are recorded; all others are silently ignored. **Fill in the real coordinates before deploying.**

## Architecture

**Event-driven, three-component design:**

1. **MQTT Worker** (`run_mqtt()`, background daemon thread) — subscribes to Home Assistant `mqtt_statestream` topics. On each message it updates the in-memory `latest_data` cache and, if ≥60 seconds have passed since the last write for that sensor, persists the reading to SQLite.

2. **SQLite Database** (`pm25.db`) — single `readings` table `(id, sensor_id, value, timestamp)` with an index on `(sensor_id, timestamp)`. Survives server restarts. `sqlite3` is part of the Python standard library — no extra service needed.

3. **FastAPI Server** — two endpoints, both rate-limited via `slowapi`:
   - `GET /api/pm25` — returns the latest reading for every sensor (served from RAM, <5ms).
   - `GET /api/pm25/history?start=&end=[&sensor_id=][&limit=]` — queries SQLite for records in the given ISO8601 time range. Every response includes `latitude`/`longitude` from the sensor registry so frontends can render a map.

**Downsampling:** MQTT messages arrive ~every 15 s per sensor; the app writes to SQLite at most once per minute per sensor (`WRITE_INTERVAL = 60`), controlled by `last_written` dict using `time.monotonic()`.

**Public exposure:** Cloudflare Tunnel (`cloudflared`) proxies a public domain to port 8000 — no router port forwarding needed.

## Key Files

- [backend/main.py](backend/main.py) — entire application (MQTT client + FastAPI app + DB logic)
- [backend/sensors.json](backend/sensors.json) — sensor registry (IDs, names, coordinates)
- [backend/requirements.txt](backend/requirements.txt) — Python dependencies
- [backend/BACKEND_MASTER_PLAN.md](backend/BACKEND_MASTER_PLAN.md) — architecture reference with Mermaid diagram
