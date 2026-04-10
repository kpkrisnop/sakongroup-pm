import { useRef } from 'react'
import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

function getPm25Color(value) {
  if (value === null || value === undefined) return '#9ca3af'
  if (value <= 12)  return '#22c55e'
  if (value <= 35)  return '#eab308'
  if (value <= 55)  return '#f97316'
  if (value <= 150) return '#ef4444'
  if (value <= 250) return '#a855f7'
  return '#7f1d1d'
}

function getPm25Label(value) {
  if (value === null || value === undefined) return 'No data'
  if (value <= 12)  return 'Good'
  if (value <= 35)  return 'Moderate'
  if (value <= 55)  return 'Unhealthy for Sensitive'
  if (value <= 150) return 'Unhealthy'
  if (value <= 250) return 'Very Unhealthy'
  return 'Hazardous'
}

function createPinIcon(color) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
      <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0z"
            fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="14" cy="14" r="5" fill="white"/>
    </svg>`
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -38],
  })
}

export default function SensorMarker({ sensor }) {
  const markerRef = useRef(null)
  const color = getPm25Color(sensor.value)
  const icon = createPinIcon(color)

  const eventHandlers = {
    mouseover() { markerRef.current?.openPopup() },
    mouseout()  { markerRef.current?.closePopup() },
  }

  return (
    <Marker
      position={[sensor.latitude, sensor.longitude]}
      icon={icon}
      ref={markerRef}
      eventHandlers={eventHandlers}
    >
      <Popup closeButton={false} autoPan={false}>
        <div style={{ fontFamily: 'system-ui, sans-serif', minWidth: '140px' }}>
          <div style={{ fontWeight: 600, color: '#111', marginBottom: '4px', fontSize: '13px' }}>
            {sensor.name}
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color, lineHeight: 1.2 }}>
            {sensor.value ?? '—'}
            <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 400, marginLeft: '4px' }}>
              {sensor.unit}
            </span>
          </div>
          <div style={{ fontSize: '11px', color, marginTop: '2px' }}>
            {getPm25Label(sensor.value)}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '6px' }}>
            {sensor.last_updated
              ? new Date(sensor.last_updated).toLocaleString()
              : 'No data'}
          </div>
        </div>
      </Popup>
    </Marker>
  )
}
