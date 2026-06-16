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
}: {
  data: DonutDatum[]
  size?: number
  thickness?: number
  centerLabel?: string
  formatValue?: (n: number) => string
}) {
  const fmt = formatValue ?? String
  const total = data.reduce((sum, d) => sum + d.value, 0)

  if (!data.length || total <= 0) {
    return <p className="barchart-empty">אין נתונים</p>
  }

  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  let acc = 0

  const ariaLabel = data.map(d => `${d.label}: ${fmt(d.value)}`).join(', ')

  return (
    <div className="donut-chart-wrap">
      <div className="donut-svg-container" style={{ width: size, height: size }} role="img" aria-label={ariaLabel}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--bg-alt)" strokeWidth={thickness} />
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            {data.map((d, i) => {
              const dash = (d.value / total) * circumference
              const offset = -acc
              acc += dash
              return (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={d.color}
                  strokeWidth={thickness}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={offset}
                />
              )
            })}
          </g>
        </svg>
        <div className="donut-center">
          <span className="donut-center-value">{fmt(total)}</span>
          {centerLabel && <span className="donut-center-label">{centerLabel}</span>}
        </div>
      </div>
      <ul className="donut-legend">
        {data.map((d, i) => (
          <li key={i} className="donut-legend-item">
            <span className="donut-legend-dot" style={{ background: d.color }} />
            <span className="donut-legend-label">{d.label}</span>
            <span className="donut-legend-value">{fmt(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
