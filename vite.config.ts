import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

// A stable id for THIS build, embedded in the bundle and also written to /version.json.
// The client compares the two to detect "a newer deploy exists but I'm running an old
// bundle" (the stale installed-PWA problem) and prompts a refresh. Prefer the CI commit
// SHA (GitHub Actions / Cloudflare Pages); fall back to the local git SHA, then 'dev'.
function resolveBuildId(): string {
  const sha = process.env.GITHUB_SHA || process.env.CF_PAGES_COMMIT_SHA
  if (sha) return sha.slice(0, 7)
  try { return execSync('git rev-parse --short HEAD').toString().trim() } catch { return 'dev' }
}

const BUILD_ID = resolveBuildId()
const BUILD_TIME = new Date().toISOString()

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'emit-version-json',
      apply: 'build',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({ buildId: BUILD_ID, builtAt: BUILD_TIME }),
        })
      },
    },
  ],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  server: {
    host: true,
    allowedHosts: true,
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
  },
})
