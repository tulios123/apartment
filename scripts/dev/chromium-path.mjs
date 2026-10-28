// Where Chromium actually is, in whatever shape the container ships it.
//
// The image has moved twice: first the build number stopped matching what Playwright asks
// for, and then (Oct 2026) the layout changed from chrome-linux/ to chrome-linux64/, which
// silently broke every hard-coded path again. A stable symlink exists — /opt/pw-browsers/
// chromium — so that is the first thing we try; the versioned directories are the fallback
// for images that predate it, and an explicit PW_CHROMIUM_PATH wins over both.
//
// Returns undefined when nothing is found, so Playwright falls back to its own download on
// a machine that has one (the owner's, and CI).
import { existsSync, readdirSync } from 'node:fs'

export function chromiumPath() {
  if (process.env.PW_CHROMIUM_PATH) return process.env.PW_CHROMIUM_PATH
  const root = '/opt/pw-browsers'
  if (!existsSync(root)) return undefined
  if (existsSync(`${root}/chromium`)) return `${root}/chromium`
  const dir = readdirSync(root).filter(d => /^chromium-\d+$/.test(d)).sort().pop()
  if (!dir) return undefined
  for (const layout of ['chrome-linux64', 'chrome-linux']) {
    const exe = `${root}/${dir}/${layout}/chrome`
    if (existsSync(exe)) return exe
  }
  return undefined
}
