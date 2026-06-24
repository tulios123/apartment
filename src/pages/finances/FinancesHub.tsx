import { Outlet } from 'react-router-dom'

export default function FinancesHub() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>תזרים</h1>
      </div>
      <Outlet />
    </div>
  )
}
