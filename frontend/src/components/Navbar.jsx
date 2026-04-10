import { NavLink } from 'react-router-dom'

export default function Navbar() {
  const linkClass = ({ isActive }) =>
    `px-3 py-1 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-gray-100 text-gray-900'
        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
    }`

  return (
    <nav className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white shrink-0">
      <span className="font-semibold text-gray-800 text-base tracking-tight">
        Sakongroup PM2.5
      </span>
      <div className="flex gap-2">
        <NavLink to="/map" className={linkClass}>Map</NavLink>
        <NavLink to="/history" className={linkClass}>History</NavLink>
      </div>
    </nav>
  )
}
