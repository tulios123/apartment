import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom'

export default function PropertyHub() {
  const { pathname } = useLocation()
  if (pathname === '/property' || pathname === '/property/') {
    return <Navigate to="/property/overview" replace />
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>הנכס</h1>
        <nav className="hub-tabs">
          <NavLink to="/property/overview" className={({ isActive }) => `hub-tab${isActive ? ' active' : ''}`}>סקירה</NavLink>
          <NavLink to="/property/details" className={({ isActive }) => `hub-tab${isActive ? ' active' : ''}`}>נכס</NavLink>
          <NavLink to="/property/mortgage" className={({ isActive }) => `hub-tab${isActive ? ' active' : ''}`}>משכנתא</NavLink>
          <NavLink to="/property/rental" className={({ isActive }) => `hub-tab${isActive ? ' active' : ''}`}>שכירות</NavLink>
          <NavLink to="/property/insurance" className={({ isActive }) => `hub-tab${isActive ? ' active' : ''}`}>ביטוח</NavLink>
          <NavLink to="/property/investment" className={({ isActive }) => `hub-tab${isActive ? ' active' : ''}`}>תשואה</NavLink>
        </nav>
      </div>
      <Outlet />
    </div>
  )
}
