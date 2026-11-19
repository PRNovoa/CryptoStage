const W = 64
const H = 20

export default function Sparkline({ points }) {
  if (points.length < 2) return <svg className="spark" viewBox={`0 0 ${W} ${H}`} aria-hidden="true" />
  const prices = points.map((p) => p.price)
  const min = Math.min(...prices)
  const span = Math.max(...prices) - min || 1
  const step = W / (points.length - 1)
  const line = prices.map((p, i) => `${(i * step).toFixed(1)},${(H - 2 - ((p - min) / span) * (H - 4)).toFixed(1)}`).join(' ')
  const dir = prices.at(-1) >= prices[0] ? 'up' : 'down'
  return (
    <svg className="spark" data-dir={dir} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={line} fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
