import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Optional: render a lighter, inline fallback (per-route) instead of the full-screen one. */
  variant?: 'screen' | 'inline'
  /** Optional label to make the logged error easier to locate (e.g. the route name). */
  boundary?: string
}

interface State {
  hasError: boolean
  message?: string
}

/**
 * Catches render/lifecycle exceptions so one malformed record can't white-screen
 * the whole PWA (audit C4). A top-level boundary wraps the router; a lighter
 * per-route boundary wraps each screen's <Outlet/> so a crash in one tab leaves
 * the shell + nav intact and offers a refresh.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message ? String(error.message).slice(0, 300) : undefined }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface the stack for diagnosis without crashing the tree.
    console.error(`[ErrorBoundary${this.props.boundary ? ` · ${this.props.boundary}` : ''}]`, error, info.componentStack)
  }

  private reset = () => {
    // A hard reload is the most reliable recovery on the installed PWA, where
    // there's no visible URL bar to refresh from.
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const inline = this.props.variant === 'inline'
    return (
      <div className={inline ? 'error-boundary error-boundary--inline' : 'error-boundary'} role="alert">
        <div className="error-boundary-card">
          <div className="error-boundary-title">משהו השתבש</div>
          <div className="error-boundary-text">
            נתקלנו בתקלה בלתי צפויה. רענון הדף בדרך כלל פותר את זה.
          </div>
          <button className="error-boundary-btn" onClick={this.reset}>רענון</button>
          {this.state.message && (
            <details className="error-boundary-details">
              <summary>פרטים טכניים</summary>
              <code>{this.state.message}</code>
            </details>
          )}
        </div>
      </div>
    )
  }
}
