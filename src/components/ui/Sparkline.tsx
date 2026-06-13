import './ui.css'

export function Sparkline({
  data,
  height = 48,
  color,
}: {
  data: number[]
  height?: number
  color?: string
}) {
  if (!data || data.length < 2) return null

  const w = 100   // viewBox width (%)
  const h = height
  const padding = 2

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const toX = (i: number) => padding + (i / (data.length - 1)) * (w - padding * 2)
  const toY = (v: number) => padding + ((max - v) / range) * (h - padding * 2)

  const pts = data.map((v, i) => `${toX(i)},${toY(v)}`).join(' ')
  // close area path back to baseline
  const areaPath =
    `M${toX(0)},${toY(data[0])} ` +
    data.map((v, i) => `L${toX(i)},${toY(v)}`).join(' ') +
    ` L${toX(data.length - 1)},${h} L${toX(0)},${h} Z`

  const lineColor = color ?? 'var(--accent, #2563eb)'

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {/* filled area */}
      <path
        d={areaPath}
        fill={lineColor}
        fillOpacity="0.12"
        stroke="none"
      />
      {/* line */}
      <polyline
        points={pts}
        fill="none"
        stroke={lineColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
