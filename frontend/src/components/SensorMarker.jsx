import { useRef } from 'react'
import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

function getAqiColor(aqi) {
  if (aqi === null || aqi === undefined) return '#9ca3af'
  if (aqi <= 50)  return '#22c55e'
  if (aqi <= 100) return '#eab308'
  if (aqi <= 150) return '#f97316'
  if (aqi <= 200) return '#ef4444'
  if (aqi <= 300) return '#a855f7'
  return '#7f1d1d'
}

function getAqiLabel(aqi) {
  if (aqi === null || aqi === undefined) return 'No data'
  if (aqi <= 50)  return 'Good'
  if (aqi <= 100) return 'Moderate'
  if (aqi <= 150) return 'Unhealthy for Sensitive'
  if (aqi <= 200) return 'Unhealthy'
  if (aqi <= 300) return 'Very Unhealthy'
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
  const color = getAqiColor(sensor.aqi)
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
            {sensor.aqi ?? '—'}
            <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 400, marginLeft: '4px' }}>
              AQI
            </span>
          </div>
          <div style={{ fontSize: '11px', color, marginTop: '2px' }}>
            {getAqiLabel(sensor.aqi)}
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
