import { defineConfig, devices } from '@playwright/test'

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
    { name: 'pixel7', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
