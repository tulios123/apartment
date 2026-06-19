import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { supabase } from './lib/supabase'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import DashboardV2 from './pages/dashboard/DashboardV2'
import FinancesV2 from './pages/finances/FinancesV2'
import LiabilitiesV2 from './pages/liabilities/LiabilitiesV2'
import PropertyV2 from './pages/property/PropertyV2'
import TasksV2 from './pages/tasks/TasksV2'
import DocumentsV2 from './pages/documents/DocumentsV2'
import FinancesHub from './pages/finances/FinancesHub'
import Finances from './pages/Finances'
import Tasks from './pages/Tasks'
import Documents from './pages/Documents'
import PropertyHub from './pages/property/PropertyHub'
import LiabilitiesHub from './pages/liabilities/LiabilitiesHub'
import Settings from './pages/Settings'
import SandboxIndex from './ux-sandbox/SandboxIndex'
import FluidView from './ux-sandbox/variants/anz-fluid/FluidView'
import CleanView from './ux-sandbox/variants/anz-clean/CleanView'
import ExpressiveView from './ux-sandbox/variants/anz-expressive/ExpressiveView'
import HybridView from './ux-sandbox/variants/anz-hybrid/HybridView'
import DualModeView from './ux-sandbox/variants/dual-mode/DualModeView'
import FinancesView from './ux-sandbox/variants/finances/FinancesView'
import LiabilitiesView from './ux-sandbox/variants/liabilities/LiabilitiesView'

function AppRoutes() {
  const { user, loading } = useAuth()
  const [hasProperty, setHasProperty] = useState<boolean | null>(null)

  useEffect(() => {
    if (!user) { setHasProperty(null); return }
    supabase
      .from('properties')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1)
      .then(({ data }) => setHasProperty((data?.length ?? 0) > 0))
  }, [user])

  // Isolated UX sandbox — bypasses auth/onboarding gates so it loads standalone.
  const sandboxPath = window.location.pathname
  if (sandboxPath.startsWith('/ux-sandbox')) {
    if (sandboxPath === '/ux-sandbox/anz-fluid') return <FluidView />
    if (sandboxPath === '/ux-sandbox/anz-clean') return <CleanView />
    if (sandboxPath === '/ux-sandbox/anz-expressive') return <ExpressiveView />
    if (sandboxPath === '/ux-sandbox/anz-hybrid') return <HybridView />
    if (sandboxPath === '/ux-sandbox/dual-mode') return <DualModeView />
    if (sandboxPath === '/ux-sandbox/finances') return <FinancesView />
    if (sandboxPath === '/ux-sandbox/liabilities') return <LiabilitiesView />
    return <SandboxIndex />
  }

  if (loading || (user && hasProperty === null)) return <div className="app-loading">טוען...</div>
  if (!user) return <Login />
  if (!hasProperty) return <Onboarding onComplete={() => setHasProperty(true)} />

  // New UX is the default; users can opt out (sets ux_v2 = '0') as an escape hatch.
  const uxV2 = localStorage.getItem('ux_v2') !== '0'

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={uxV2 ? <DashboardV2 /> : <Dashboard />} />
          <Route path="finances" element={<FinancesHub />}>
            <Route index element={uxV2 ? <FinancesV2 /> : <Finances />} />
            <Route path="recurring" element={<Navigate to="/finances" replace />} />
          </Route>
          <Route path="recurring" element={<Navigate to="/finances" replace />} />
          <Route path="tasks" element={uxV2 ? <TasksV2 /> : <Tasks />} />
          <Route path="documents" element={uxV2 ? <DocumentsV2 /> : <Documents />} />
          <Route path="property" element={uxV2 ? <PropertyV2 /> : <PropertyHub />} />
          <Route path="property/mortgage" element={<Navigate to="/liabilities/mortgage" replace />} />
          <Route path="property/:section" element={uxV2 ? <PropertyV2 /> : <PropertyHub />} />
          <Route path="liabilities" element={uxV2 ? <LiabilitiesV2 /> : <LiabilitiesHub />} />
          <Route path="liabilities/:section" element={uxV2 ? <LiabilitiesV2 /> : <LiabilitiesHub />} />
          <Route path="mortgage" element={<Navigate to="/liabilities/mortgage" replace />} />
          <Route path="investment" element={<Navigate to="/property/investment" replace />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
