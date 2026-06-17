import './ui.css'

export interface DonutDatum {
  label: string
  value: number
  color: string
}

export function DonutChart({
  data,
  size = 168,
  thickness = 24,
  centerLabel,
  formatValue,
  showLegend = true,
}: {
  data: DonutDatum[]
  size?: number
  thickness?: number
  centerLabel?: string
  formatValue?: (n: number) => string
  showLegend?: boolean
}) {
  const fmt = formatValue ?? String
  const total = data.reduce((sum, d) => sum + d.value, 0)

  if (!data.length || total <= 0) {
    return <p className="barchart-empty">אין נתונים</p>
  }

  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius

  // Precompute each arc's length and its starting offset (cumulative prior arcs),
  // so the JSX below stays free of render-time mutation.
  const dashes = data.map(d => (d.value / total) * circumference)
  const segments = data.map((d, i) => ({
    ...d,
    dash: dashes[i],
    offset: -dashes.slice(0, i).reduce((sum, n) => sum + n, 0),
  }))

  const ariaLabel = data.map(d => `${d.label}: ${fmt(d.value)}`).join(', ')

  return (
    <div className={`donut-chart-wrap${showLegend ? '' : ' donut-chart-mini'}`}>
      <div className="donut-svg-container" style={{ width: size, height: size }} role="img" aria-label={ariaLabel}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--bg-alt)" strokeWidth={thickness} />
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            {segments.map((s, i) => (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${s.dash} ${circumference - s.dash}`}
                strokeDashoffset={s.offset}
              />
            ))}
          </g>
        </svg>
        <div className="donut-center">
          <span className="donut-center-value">{fmt(total)}</span>
          {centerLabel && <span className="donut-center-label">{centerLabel}</span>}
        </div>
      </div>
      {showLegend && <ul className="donut-legend">
        {data.map((d, i) => (
          <li key={i} className="donut-legend-item">
            <span className="donut-legend-dot" style={{ background: d.color }} />
            <span className="donut-legend-label">{d.label}</span>
            <span className="donut-legend-pct">{Math.round(d.value / total * 100)}%</span>
            <span className="donut-legend-value">{fmt(d.value)}</span>
          </li>
        ))}
      </ul>}
    </div>
  )
}
