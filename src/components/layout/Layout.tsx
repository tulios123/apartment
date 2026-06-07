import { NavLink, Outlet } from 'react-router-dom'
import { useMonthlyGeneration } from '../../hooks/useMonthlyGeneration'

const navItems = [
  { to: '/', label: 'ראשי', end: true },
  { to: '/finances', label: 'כספים' },
  { to: '/recurring', label: 'קבועים' },
  { to: '/tasks', label: 'משימות' },
  { to: '/documents', label: 'מסמכים' },
  { to: '/settings', label: 'הגדרות' },
]

export default function Layout() {
  useMonthlyGeneration()

  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="sidebar-title">דירה</div>
        {navItems.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
