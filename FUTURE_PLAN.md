# Future Plan: Sakongroup PM2.5 — Scalability & Improvement Assessment

## Current Setup

- Single SQLite file, single FastAPI process, single Proxmox LXC on a home internet connection
- Cloudflare Tunnel handles public exposure and DDoS protection

**Performance ceiling:**
- SQLite handles ~100 concurrent reads fine but locks on every write — acceptable for current sensor count but degrades with many sensors or high API traffic
- FastAPI single process handles ~500–1000 req/s for simple endpoints on modern hardware
- Home internet upload bandwidth is the real bottleneck — typically 10–50 Mbps, shared with the household

**Honest assessment for current scale:** More than sufficient. For dozens of sensors and hundreds of clock devices polling every few minutes, this setup will not break a sweat.

---

## Scalability Path

### Phase 1 — Still Home Lab, Better Architecture
*Trigger: ~50 sensors or ~1000 devices*

- Replace SQLite with **PostgreSQL + TimescaleDB extension** (purpose-built for time-series sensor data, runs on the same Proxmox host)
- Add **connection pooling** via `asyncpg` — FastAPI becomes fully async, handles 5–10x more concurrent connections
- Move the MQTT worker to a separate process so it never competes with API requests

### Phase 2 — Move to a VPS
*Trigger: First paying customer / reliability requirement*

- **Hetzner Cloud** (€4–6/month) or DigitalOcean/Vultr — outperforms home lab, has uptime SLA (~99.9%)
- Same codebase, just different host — no architectural change needed
- Static IP, no Cloudflare Tunnel dependency (though keep it for DDoS protection)
- Eliminates home internet/power cut risk

### Phase 3 — Enterprise/Government Scale
*Trigger: City-wide or national deployment*

- **TimescaleDB** on a managed database service (AWS RDS, Supabase)
- **Multiple FastAPI instances** behind a load balancer (nginx or Cloudflare)
- **MQTT broker** moves to a cloud service (HiveMQ Cloud, AWS IoT Core) — removes dependency on home Mosquitto
- Consider **InfluxDB** as an alternative to PostgreSQL for pure time-series workloads

---

## Specific Improvements for the ESP32 Clock Use Case

### 1. Location-based endpoint
Clocks query the nearest sensor by GPS coordinates. Add:
```
GET /api/pm25/nearest?lat=17.15&lng=104.14
```
Returns the single closest sensor's reading. The ESP32 only stores its own coordinates (set once during setup) and makes one simple API call.

### 2. Lightweight device endpoint
ESP32s have limited memory — current response includes unnecessary fields. Add:
```
GET /api/pm25/device?sensor_id=pm25_01
```
Returns only `{ "value": 145, "aqi_level": "unhealthy", "color": "#ef4444" }` — pre-computed, minimal payload.

### 3. API key authentication (before commercial launch)
Each customer/school gets their own API key:
- Enables access revocation, usage tracking, and pricing tiers
- Prevents unauthorized scraping
- FastAPI `Depends()` header check — roughly one day of implementation work

### 4. Offline fallback on ESP32
For hospitals/schools, the clock must show *something* if the API is down. Cache the last known value in the ESP32's flash memory with a "last updated X minutes ago" indicator.

### 5. Rate limit tuning
A fleet of 100 clocks each polling every 60 seconds = ~1.7 req/s. Current 60 req/min limit is per IP — if all clocks share a school's IP, they count as one. Fine for now; revisit when selling to large campuses.

---

## Risk Summary

| Concern | Current State | When to Upgrade |
|---|---|---|
| Database | SQLite ✓ | >50 sensors or complex queries |
| API performance | FastAPI single process ✓ | >5,000 req/min sustained |
| Reliability | Home internet ✗ | First paying customer |
| MQTT broker | Home Mosquitto ✓ | >100 sensors |
| Security | Rate limiting only | Before commercial launch |

**Biggest risk is not performance — it is reliability.** A home internet outage, power cut, or ISP issue takes down every clock in every school simultaneously. Move to a VPS before selling to institutions. Everything else can scale gradually.
