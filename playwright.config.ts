import { existsSync, readdirSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

/**
 * Where Chromium actually is.
 *
 * This environment ships browsers under /opt/pw-browsers at a build number that does not
 * match the one Playwright asks for, so a spec that does not say otherwise fails to LAUNCH
 * — "Executable doesn't exist … chromium_headless_shell-1228". Thirty-one specs already
 * worked around it with an identical `test.use({ launchOptions: { executablePath } })`
 * block; five did not, and those five — including onboarding and the data-reset walk — had
 * therefore never run here at all. Sixteen tests that looked like failures were sixteen
 * tests that never started, which is a worse thing to have in a suite than a red one.
 *
 * Resolved rather than hard-coded: an env var wins, then whatever chromium- build is
 * actually present, and otherwise nothing at all, so Playwright's own download is used on
 * a machine that has one (the owner's, and CI).
 */
function chromiumPath(): string | undefined {
  if (process.env.PW_CHROMIUM_PATH) return process.env.PW_CHROMIUM_PATH
  const root = '/opt/pw-browsers'
  if (!existsSync(root)) return undefined
  const dir = readdirSync(root)
    .filter(d => /^chromium-\d+$/.test(d))
    .sort()
    .pop()
  if (!dir) return undefined
  const exe = `${root}/${dir}/chrome-linux/chrome`
  return existsSync(exe) ? exe : undefined
}

const CHROMIUM = chromiumPath()
// Outbound HTTPS in the cloud container goes through an agent proxy; a browser that does
// not know about it cannot reach Supabase, so any spec driving the REAL backend hangs on
// an auth call that never lands. The offline specs set this themselves, one copy each —
// here it is once, and only when there is a proxy to point at.
const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy
const launchOptions = {
  ...(CHROMIUM ? { executablePath: CHROMIUM } : {}),
  ...(PROXY ? { proxy: { server: PROXY, bypass: 'localhost,127.0.0.1' } } : {}),
}
const hasLaunchOptions = Object.keys(launchOptions).length > 0

// Night-audit e2e config. Primary device: WebKit iPhone 16 Pro; secondary: Chromium Pixel 7.
// The dev server auto-logs-in with the test account (VITE_DEV_BYPASS_AUTH in .env.local),
// so specs start authenticated unless they target the bypass-off server (port 5174).
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  outputDir: './e2e/.results',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'iphone16pro', use: { ...devices['iPhone 16 Pro'] } },
    { name: 'pixel7', use: { ...devices['Pixel 7'], ...(hasLaunchOptions ? { launchOptions } : {}) } },
  ],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
