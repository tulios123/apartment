import { inPreviewMode } from '../lib/previewAuth'

// A slim marker shown ONLY on a per-fix preview deploy (or after a redeemed preview login),
// so the owner always knows they're testing an unmerged fix on live data — not the real app.
export default function PreviewBanner() {
  if (!inPreviewMode()) return null
  return (
    <div className="preview-banner" role="status" aria-live="polite">
      🔧 סביבת עבודה (staging) — נתונים אמיתיים
    </div>
  )
}
