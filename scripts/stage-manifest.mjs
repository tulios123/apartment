// Post-build patch for the STAGING deploy only (run after `vite build` in
// deploy-staging.yml). Gives the workspace a distinct identity so it's unmistakable next to
// the real app on the home screen: a different name and a warning-orange theme. Never runs
// for production. No-op-safe if a file/pattern is missing.
import { readFile, writeFile, copyFile } from 'node:fs/promises'

const NAME = 'דירה · בדיקות'
const SHORT = 'בדיקות'
const THEME = '#C2410C' // warning orange

try {
  const p = 'dist/manifest.webmanifest'
  const m = JSON.parse(await readFile(p, 'utf8'))
  m.name = NAME
  m.short_name = SHORT
  m.theme_color = THEME
  await writeFile(p, JSON.stringify(m, null, 2))
  console.log('staged manifest:', NAME)
} catch (e) {
  console.error('manifest patch skipped:', e.message)
}

// Swap in the staging-badged icons (orange frame + badge) so the home-screen ICON is visually
// distinct too, not just the name. The *-staging.png variants ship in public/ → dist/.
try {
  await copyFile('dist/apple-touch-icon-staging.png', 'dist/apple-touch-icon.png')
  await copyFile('dist/icon-192-staging.png', 'dist/icon-192.png')
  await copyFile('dist/icon-512-staging.png', 'dist/icon-512.png')
  console.log('staged icons')
} catch (e) {
  console.error('icon swap skipped:', e.message)
}

try {
  const p = 'dist/index.html'
  let html = await readFile(p, 'utf8')
  html = html
    .replace(/<title>[^<]*<\/title>/, `<title>${NAME}</title>`)
    .replace(/(name="apple-mobile-web-app-title" content=")[^"]*(")/, `$1${NAME}$2`)
    .replace(/(name="theme-color" content=")[^"]*(")/, `$1${THEME}$2`)
  await writeFile(p, html)
  console.log('staged index.html')
} catch (e) {
  console.error('html patch skipped:', e.message)
}
