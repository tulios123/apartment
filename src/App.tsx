import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { supabase } from './lib/supabase'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import HomeScreen from './pages/dashboard/HomeScreen'
import FinancesV2 from './pages/finances/FinancesV2'
import LiabilitiesV2 from './pages/liabilities/LiabilitiesV2'
import PropertyV2 from './pages/property/PropertyV2'
import TasksV2 from './pages/tasks/TasksV2'
import DocumentsV2 from './pages/documents/DocumentsV2'
import FinancesHub from './pages/finances/FinancesHub'
import Settings from './pages/Settings'

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

  if (loading || (user && hasProperty === null)) return <div className="app-loading">טוען...</div>
  if (!user) return <Login />
  if (!hasProperty) return <Onboarding onComplete={() => setHasProperty(true)} />

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomeScreen />} />
          <Route path="finances" element={<FinancesHub />}>
            <Route index element={<FinancesV2 />} />
            <Route path="recurring" element={<Navigate to="/finances" replace />} />
          </Route>
          <Route path="recurring" element={<Navigate to="/finances" replace />} />
          <Route path="tasks" element={<TasksV2 />} />
          <Route path="documents" element={<DocumentsV2 />} />
          <Route path="property" element={<PropertyV2 />} />
          <Route path="property/mortgage" element={<Navigate to="/liabilities/mortgage" replace />} />
          <Route path="property/:section" element={<PropertyV2 />} />
          <Route path="liabilities" element={<LiabilitiesV2 />} />
          <Route path="liabilities/:section" element={<LiabilitiesV2 />} />
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
