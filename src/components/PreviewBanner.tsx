import { isStaging } from '../lib/env'
import { inPreviewMode } from '../lib/previewAuth'

// Persistent marker shown ONLY on the staging workspace (build-time VITE_APP_ENV=staging, or
// a legacy preview host), so the owner always knows changes here don't touch real users —
// this is where fixes are verified before "פרסם לכולם".
export default function PreviewBanner() {
  if (!isStaging && !inPreviewMode()) return null
  return (
    <div className="preview-banner" role="status" aria-live="polite">
      🔧 סביבת בדיקות — שינויים כאן לא משפיעים על המשתמשים
    </div>
  )
}
