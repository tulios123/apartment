import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { pushSupported, registerSW } from './lib/push'
import { applyTheme, initThemeSync } from './lib/theme'

// The inline script in index.html set the initial theme; re-assert from the saved
// pref and keep 'system' synced to OS changes.
applyTheme()
initThemeSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register the push service worker. Prod always; in dev only when explicitly
// opted in (VITE_ENABLE_SW_DEV=true) so the SW doesn't surprise the dev loop.
if ((import.meta.env.PROD || import.meta.env.VITE_ENABLE_SW_DEV === 'true') && pushSupported()) {
  window.addEventListener('load', () => { registerSW().catch(() => {}) })
}
