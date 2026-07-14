import { Outlet, NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/assets', label: 'Fixed Assets' },
  { to: '/forecast', label: 'Forecast' },
  { to: '/summary', label: 'Summary Report' },
  { to: '/acquisitions', label: 'Acquisitions' },
  { to: '/import', label: 'Import Excel' },
]

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-blue-800 text-white px-6 py-3 flex items-center gap-6">
        <div>
          <div className="font-bold text-lg leading-tight">PT. Sankyu Indonesia International</div>
          <div className="text-blue-200 text-xs">Fixed Asset & Depreciation Management</div>
        </div>
        <nav className="flex gap-1 ml-8">
          {navItems.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  isActive ? 'bg-white text-blue-800' : 'text-blue-100 hover:bg-blue-700'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
      <footer className="bg-gray-100 border-t text-center text-xs text-gray-500 py-2">
        Fixed Asset & Depreciation App — PT. Sankyu Indonesia International
      </footer>
    </div>
  )
}
