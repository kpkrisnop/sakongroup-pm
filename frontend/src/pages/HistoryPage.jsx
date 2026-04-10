import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { fetchLatest, fetchHistory } from '../api/pm25'
import HistoryTable from '../components/HistoryTable'

const LINE_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4']

function pivotRecords(records) {
  const byTime = {}
  for (const r of records) {
    if (!byTime[r.timestamp]) byTime[r.timestamp] = { timestamp: r.timestamp }
    byTime[r.timestamp][r.sensor_id] = r.value
  }
  return Object.values(byTime).sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function yesterday() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

export default function HistoryPage() {
  const [startDate, setStartDate] = useState(yesterday())
  const [endDate, setEndDate]     = useState(today())
  const [selectedSensor, setSelectedSensor] = useState('')
  const [sensorList, setSensorList] = useState([])
  const [records, setRecords]     = useState([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)

  useEffect(() => {
    fetchLatest().then(setSensorList).catch(() => {})
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const data = await fetchHistory({
        start: startDate,
        end: endDate + 'T23:59:59Z',
        sensor_id: selectedSensor || undefined,
      })
      setRecords(data)
    } catch (err) {
      setError('Failed to load history data.')
    } finally {
      setLoading(false)
    }
  }

  const chartData   = pivotRecords(records)
  const sensorIds   = [...new Set(records.map(r => r.sensor_id))]
  const nameMap     = Object.fromEntries(sensorList.map(s => [s.sensor_id, s.name]))

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-5xl mx-auto p-6 space-y-6">

        {/* Controls */}
        <form onSubmit={handleSubmit}
              className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Start</label>
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={e => setStartDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">End</label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={today()}
              onChange={e => setEndDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sensor</label>
            <select
              value={selectedSensor}
              onChange={e => setSelectedSensor(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              <option value="">All sensors</option>
              {sensorList.map(s => (
                <option key={s.sensor_id} value={s.sensor_id}>{s.name}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Submit'}
          </button>
        </form>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {/* Chart */}
        {chartData.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
              PM2.5 History
            </h2>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={ts => new Date(ts).toLocaleDateString()}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickLine={false}
                />
                <YAxis
                  unit=" µg"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  labelFormatter={ts => new Date(ts).toLocaleString()}
                  formatter={(value, name) => [
                    `${value} µg/m³`,
                    nameMap[name] ?? name,
                  ]}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  formatter={name => nameMap[name] ?? name}
                  wrapperStyle={{ fontSize: '12px' }}
                />
                {sensorIds.map((id, i) => (
                  <Line
                    key={id}
                    type="monotone"
                    dataKey={id}
                    stroke={LINE_COLORS[i % LINE_COLORS.length]}
                    dot={false}
                    strokeWidth={2}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {records.length === 0 && !loading && !error && (
          <div className="text-center text-gray-400 text-sm py-12">
            Select a date range and press Submit to view history.
          </div>
        )}

        {/* Table */}
        <HistoryTable records={records} />
      </div>
    </div>
  )
}
