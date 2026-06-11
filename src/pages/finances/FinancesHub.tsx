import { NavLink, Outlet } from 'react-router-dom'

export default function FinancesHub() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>כספים</h1>
        <nav className="hub-tabs">
          <NavLink to="/finances" end className={({ isActive }) => `hub-tab${isActive ? ' active' : ''}`}>
            תנועות
          </NavLink>
          <NavLink to="/finances/recurring" className={({ isActive }) => `hub-tab${isActive ? ' active' : ''}`}>
            קבועים
          </NavLink>
        </nav>
      </div>
      <Outlet />
    </div>
  )
}
