import './ui.css'

export function BarChart({
  data,
  height = 160,
  formatValue,
}: {
  data: { label: string; value: number; color?: string }[]
  height?: number
  formatValue?: (n: number) => string
}) {
  if (!data || data.length === 0) {
    return <p className="barchart-empty">אין נתונים</p>
  }

  const fmt = formatValue ?? String
  const values = data.map((d) => d.value)
  const maxVal = Math.max(...values, 0)
  // Use 1 as minimum to avoid divide-by-zero; bars will all be at 0% height
  const effectiveMax = maxVal || 1

  const ariaLabel = data.map((d) => `${d.label}: ${fmt(d.value)}`).join(', ')

  return (
    <div
      className="barchart"
      role="img"
      aria-label={ariaLabel}
      style={{ height: `${height + 40}px` }}
    >
      <div className="barchart-bars" style={{ height: `${height}px` }}>
        {data.map((d, i) => {
          const pct = Math.max(d.value, 0) / effectiveMax * 100
          const color = d.color ?? 'var(--accent)'
          return (
            <div key={i} className="barchart-col">
              <span className="barchart-value">{fmt(d.value)}</span>
              <div
                className="barchart-bar"
                style={{ height: `${pct}%`, background: color }}
                title={`${d.label}: ${fmt(d.value)}`}
              />
            </div>
          )
        })}
      </div>
      <div className="barchart-labels">
        {data.map((d, i) => (
          <div key={i} className="barchart-label">{d.label}</div>
        ))}
      </div>
    </div>
  )
}
