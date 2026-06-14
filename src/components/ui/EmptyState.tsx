import './ui.css'
import type React from 'react'
import { Warning } from '@phosphor-icons/react'

export function PageError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="empty-state-cta">
      <div className="empty-state-cta-icon" style={{ color: 'var(--danger)' }}>
        <Warning size={40} />
      </div>
      <p>{message}</p>
      <button className="btn-secondary" onClick={onRetry ?? (() => window.location.reload())}>
        נסה שוב
      </button>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  hint,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode
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
