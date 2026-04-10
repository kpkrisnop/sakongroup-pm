export default function HistoryTable({ records }) {
  if (!records.length) return null

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Sensor</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Timestamp</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Value</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Unit</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => (
              <tr key={i} className="border-b border-gray-100 even:bg-gray-50">
                <td className="px-4 py-2 font-medium text-gray-700">{r.name}</td>
                <td className="px-4 py-2 text-gray-500">
                  {new Date(r.timestamp).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-gray-800">{r.value}</td>
                <td className="px-4 py-2 text-gray-400">{r.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
