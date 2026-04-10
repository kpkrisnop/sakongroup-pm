import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import MapPage from './pages/MapPage'
import HistoryPage from './pages/HistoryPage'

export default function App() {
  return (
    <div className="flex flex-col h-full bg-white">
      <Navbar />
      <div className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<Navigate to="/map" replace />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </div>
    </div>
  )
}
