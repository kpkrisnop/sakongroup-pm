import { useEffect, useState } from 'react'
import { MapContainer, TileLayer } from 'react-leaflet'
import { fetchLatest } from '../api/pm25'
import SensorMarker from '../components/SensorMarker'

export default function MapPage() {
  const [sensors, setSensors] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchLatest().then(setSensors).catch(setError)
  }, [])

  const center = sensors.length
    ? [
        sensors.reduce((s, x) => s + x.latitude,  0) / sensors.length,
        sensors.reduce((s, x) => s + x.longitude, 0) / sensors.length,
      ]
    : [17.1535, 104.1427]

  return (
    <div className="h-full w-full relative">
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]
                        bg-red-50 border border-red-200 text-red-700 text-sm
                        px-4 py-2 rounded-lg shadow">
          Failed to load sensor data
        </div>
      )}
      <MapContainer
        center={center}
        zoom={17}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {sensors.map(sensor => (
          <SensorMarker key={sensor.sensor_id} sensor={sensor} />
        ))}
      </MapContainer>
    </div>
  )
}
