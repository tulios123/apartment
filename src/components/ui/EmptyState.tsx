import './ui.css'

export function EmptyState({
  icon,
  title,
  hint,
  actionLabel,
  onAction,
}: {
  icon: string
  title: string
  hint?: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="empty-state-cta">
      <div className="empty-state-cta-icon">{icon}</div>
      <p>{title}</p>
      {hint && <p className="empty-state-cta-hint">{hint}</p>}
      {actionLabel && onAction && (
        <button className="btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}
