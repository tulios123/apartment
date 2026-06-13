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

  const values = data.map((d) => d.value)
  const maxVal = Math.max(...values, 0)
  const minVal = Math.min(...values, 0)
  const range = maxVal - minVal || 1

  // Layout constants
  const labelHeight = 18   // space below baseline for labels
  const valueHeight = 14   // space above chart for positive-value labels
  const paddingTop = valueHeight
  const paddingBottom = labelHeight
  const chartH = height - paddingTop - paddingBottom  // drawable bar area
  const n = data.length
  const barPct = 0.6        // bar occupies 60% of slot width
  const slotW = 100 / n     // percent

  // Y position helpers (0% = top of SVG drawing area)
  // baseline at the "zero" position in chart coordinates
  const baselineY = paddingTop + (maxVal / range) * chartH

  const fmt = formatValue ?? String

  return (
    <svg
      className="barchart"
      viewBox={`0 0 100 ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {/* Baseline */}
      <line
        x1="0"
        y1={baselineY}
        x2="100"
        y2={baselineY}
        stroke="var(--border, #e2e8f0)"
        strokeWidth="0.5"
        vectorEffect="non-scaling-stroke"
      />

      {data.map((d, i) => {
        const slotCenter = slotW * i + slotW / 2
        const barW = slotW * barPct
        const barX = slotCenter - barW / 2

        // bar height in SVG units (proportional to value)
        const barH = Math.abs(d.value) / range * chartH
        const barY = d.value >= 0 ? baselineY - barH : baselineY
        const color = d.color ?? 'var(--accent, #2563eb)'

        const labelY = height - 2          // just above bottom
        const valLabel = fmt(d.value)

        return (
          <g key={i} className="barchart-bar">
            <title>{`${d.label}: ${valLabel}`}</title>
            <rect
              x={barX}
              y={barY}
              width={barW}
              height={Math.max(barH, 0.5)}
              fill={color}
              rx="1.5"
              ry="1.5"
            />
            {/* Label below baseline */}
            <text
              x={slotCenter}
              y={labelY}
              textAnchor="middle"
              className="barchart-label"
              fontSize="3.5"
            >
              {d.label.length > 5 ? d.label.slice(0, 5) + '…' : d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
