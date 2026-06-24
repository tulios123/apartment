// Theme manager — light / dark / system. The dark token block in index.css is
// keyed on :root[data-theme="dark"]; this module owns that attribute. 'system'
// resolves against the OS preference and stays in sync as it changes.
export type ThemePref = 'light' | 'dark' | 'system'

const KEY = 'theme'

export function getThemePref(): ThemePref {
  const v = localStorage.getItem(KEY)
  return v === 'light' || v === 'dark' ? v : 'system'
}

function systemIsDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveTheme(pref: ThemePref): 'light' | 'dark' {
  return pref === 'system' ? (systemIsDark() ? 'dark' : 'light') : pref
}

export function applyTheme(pref: ThemePref = getThemePref()): void {
  document.documentElement.dataset.theme = resolveTheme(pref)
}

export function setThemePref(pref: ThemePref): void {
  if (pref === 'system') localStorage.removeItem(KEY)
  else localStorage.setItem(KEY, pref)
  applyTheme(pref)
}

// Keep the UI in sync when the OS theme flips while the user is on 'system'.
export function initThemeSync(): void {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getThemePref() === 'system') applyTheme('system')
  })
}
