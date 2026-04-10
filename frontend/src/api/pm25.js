const BASE = '/api'

export async function fetchLatest() {
  const res = await fetch(`${BASE}/pm25`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function fetchHistory({ start, end, sensor_id, limit = 1000 }) {
  const params = new URLSearchParams({ start, end, limit })
  if (sensor_id) params.append('sensor_id', sensor_id)
  const res = await fetch(`${BASE}/pm25/history?${params}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
