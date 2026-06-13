import './ui.css'

/** Single shimmer block */
export function Skeleton({
  width,
  height,
  radius,
  className,
}: {
  width?: string | number
  height?: string | number
  radius?: number
  className?: string
}) {
  const style: React.CSSProperties = {
    width: width !== undefined ? (typeof width === 'number' ? `${width}px` : width) : '100%',
    height: height !== undefined ? (typeof height === 'number' ? `${height}px` : height) : 16,
    borderRadius: radius !== undefined ? radius : undefined,
  }
  return <span className={`skeleton${className ? ` ${className}` : ''}`} style={style} />
}

/** Stacked text lines of varying width */
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  // widths cycle through to create natural variation
  const widths = ['90%', '75%', '85%', '60%', '80%', '50%']
  return (
    <div className="skeleton-text">
      {Array.from({ length: lines }).map((_, i) => (
        <span
          key={i}
          className="skeleton skeleton-text-line"
          style={{ width: widths[i % widths.length] }}
        />
      ))}
    </div>
  )
}

/** Card-shaped shimmer that mirrors .summary-card proportions */
export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <span className="skeleton skeleton-card-label" />
      <span className="skeleton skeleton-card-value" />
    </div>
  )
}

/** Row of stat-card skeletons in a grid — mirrors .summary-cards layout */
export function SkeletonStats({ count = 3 }: { count?: number }) {
  return (
    <div className="skeleton-stats">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

/** List-row skeletons — wraps in a card container */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="skeleton-list">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-list-row">
          <div className="skeleton-list-left">
            <span className="skeleton skeleton-list-main" />
            <span className="skeleton skeleton-list-sub" />
          </div>
          <span className="skeleton skeleton-list-right" />
        </div>
      ))}
    </div>
  )
}
