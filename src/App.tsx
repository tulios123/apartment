import { useState, useEffect, useCallback, useMemo } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { AppReadyContext } from './contexts/AppReadyContext'
import { supabase } from './lib/supabase'
import Layout from './components/layout/Layout'
import { Splash } from './components/ui/Splash'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import HomeScreen from './pages/dashboard/HomeScreen'
import FinancesV2 from './pages/finances/FinancesV2'
import WealthHub from './pages/wealth/WealthHub'
import PropertyAdminHub from './pages/property/PropertyAdminHub'
import FinancesHub from './pages/finances/FinancesHub'
import Settings from './pages/Settings'
import FeedbackAdmin from './pages/admin/FeedbackAdmin'
import { PrivacyPolicy, TermsOfService, Accessibility } from './pages/legal/LegalPages'
import DevNotes from './components/DevNotes'
import { ErrorBoundary } from './components/ErrorBoundary'
import { OfflineBanner } from './components/OfflineBanner'
import { pushNotifTarget } from './lib/notifNav'

function AppRoutes() {
  const { user, loading } = useAuth()
  const [hasProperty, setHasProperty] = useState<boolean | null>(null)
  // After repeated property-check failures, show a manual retry screen instead of
  // falling through to Onboarding (which would create a duplicate property — C3).
  const [propertyError, setPropertyError] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)
  // Keep the splash up until the first screen's data has loaded (markReady), so the
  // user goes straight from splash to a fully-populated app — no skeleton flash.
  // Only the home route signals ready, so only hold the splash when we actually land
  // on home; a cold-start/deep-link to any other tab renders its own (fast) skeletons
  // immediately instead of waiting out the 5s safety ceiling on a blank splash.
  const [appReady, setAppReady] = useState(() => window.location.pathname !== '/')
  const markReady = useCallback(() => setAppReady(true), [])
  const readyValue = useMemo(() => ({ markReady }), [markReady])

  useEffect(() => {
    if (!user) { setHasProperty(null); setPropertyError(false); return }
    let cancelled = false
    let attempt = 0
    let timer: ReturnType<typeof setTimeout>

    async function check() {
      const { data, error } = await supabase
        .from('properties')
        .select('id')
        .eq('owner_id', user!.id)
        .limit(1)
      if (cancelled) return
      if (error) {
        // C3: an errored check is UNKNOWN, never "no property". Keep hasProperty
        // null (stay on Splash) and retry with capped backoff; after a few
        // failures surface a manual retry rather than routing to Onboarding.
        attempt++
        if (attempt >= 4) { setPropertyError(true); return }
        timer = setTimeout(check, Math.min(1000 * 2 ** (attempt - 1), 8000))
        return
      }
      setPropertyError(false)
      setHasProperty((data?.length ?? 0) > 0)
    }

    check()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [user, retryNonce])

  // EDGE-08: capture notification-tap navigations at the app root (always mounted —
  // unlike the authed Layout), buffering the target until a Router-bound consumer
  // (Layout) subscribes, so a tap on Login/Onboarding/cold-start still routes correctly.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'navigate' && typeof e.data.url === 'string') pushNotifTarget(e.data.url)
    }
    navigator.serviceWorker.addEventListener('message', onMsg)
    return () => navigator.serviceWorker.removeEventListener('message', onMsg)
  }, [])

  // Safety ceiling: never trap the user behind the splash if no screen signals ready
  // (e.g. a query error, or a first route that isn't Home).
  useEffect(() => {
    if (appReady || loading || !user || !hasProperty) return
    const t = setTimeout(() => setAppReady(true), 5000)
    return () => clearTimeout(t)
  }, [appReady, loading, user, hasProperty])

  // Legal pages are public — reachable without an account (e.g. the Privacy Policy
  // URL Google requires). Serve them before the auth gate, in a minimal standalone
  // frame with its own Router (so the in-page back button works).
  if (window.location.pathname.startsWith('/legal/')) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/legal/privacy" element={<PrivacyPolicy />} />
          <Route path="/legal/terms" element={<TermsOfService />} />
          <Route path="/legal/accessibility" element={<Accessibility />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    )
  }

  if (loading) return <Splash />
  if (!user) return <Login />
  if (propertyError) return (
    <div className="error-boundary" role="alert">
      <div className="error-boundary-card">
        <div className="error-boundary-title">לא הצלחנו לטעון</div>
        <div className="error-boundary-text">בדקו את החיבור לאינטרנט ונסו שוב.</div>
        <button
          className="error-boundary-btn"
          onClick={() => { setPropertyError(false); setRetryNonce((n) => n + 1) }}
        >
          נסו שוב
        </button>
      </div>
    </div>
  )
  if (hasProperty === null) return <Splash />
  if (!hasProperty) return <Onboarding onComplete={() => setHasProperty(true)} />

  return (
    <AppReadyContext.Provider value={readyValue}>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomeScreen />} />
          <Route path="finances" element={<FinancesHub />}>
            <Route index element={<FinancesV2 />} />
            <Route path="recurring" element={<Navigate to="/finances" replace />} />
          </Route>
          <Route path="recurring" element={<Navigate to="/finances" replace />} />

          {/* Wealth (Investment) pillar */}
          <Route path="wealth" element={<WealthHub />} />
          <Route path="wealth/:section" element={<WealthHub />} />

          {/* Property Admin pillar */}
          <Route path="property" element={<PropertyAdminHub />} />
          <Route path="property/:section" element={<PropertyAdminHub />} />

          {/* Legacy deep-link redirects → new pillars */}
          <Route path="property/mortgage" element={<Navigate to="/wealth/liabilities" replace />} />
          <Route path="property/costs" element={<Navigate to="/wealth" replace />} />
          <Route path="property/investment" element={<Navigate to="/wealth" replace />} />
          <Route path="liabilities" element={<Navigate to="/wealth/liabilities" replace />} />
          <Route path="liabilities/:section" element={<Navigate to="/wealth/liabilities" replace />} />
          <Route path="mortgage" element={<Navigate to="/wealth/liabilities" replace />} />
          <Route path="investment" element={<Navigate to="/wealth" replace />} />
          <Route path="tasks" element={<Navigate to="/property/tasks" replace />} />
          <Route path="documents" element={<Navigate to="/property/documents" replace />} />

          <Route path="settings" element={<Settings />} />
          <Route path="admin/feedback" element={<FeedbackAdmin />} />

          <Route path="legal/privacy" element={<PrivacyPolicy />} />
          <Route path="legal/terms" element={<TermsOfService />} />
          <Route path="legal/accessibility" element={<Accessibility />} />

          {/* Catch-all: any unmatched or stale deep-link lands on Home, not a blank screen */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
    {!appReady && <div className="splash-overlay"><Splash /></div>}
    </AppReadyContext.Provider>
  )
}

// Notes overlay: in local dev, and for the dev@test.local manager account on the
// live app (so notes can be taken/copied across screens while reviewing in prod).
function DevNotesGate() {
  const { user } = useAuth()
  if (!(import.meta.env.DEV || user?.email === 'dev@test.local')) return null
  return <DevNotes />
}

export default function App() {
  return (
    <AuthProvider>
      <OfflineBanner />
      <ErrorBoundary boundary="root">
        <AppRoutes />
      </ErrorBoundary>
      <DevNotesGate />
    </AuthProvider>
  )
}
