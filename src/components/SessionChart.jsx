import { useRef, useState } from 'react'
import { formatPrice } from '../format.js'
import { useProgress } from '../motion.js'

const W = 600
const H = 180
const PAD = 10
const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })
// Near an edge the tooltip anchors to that edge instead of centring, so it never leaves the plot.
const align = (f) => (f < 0.15 ? 'start' : f > 0.85 ? 'end' : 'center')

// One series of received prices on their real timestamps. The scale is always exact; when a price
// arrives, only the newest segment draws out toward it over 300 ms. No samples are invented.
export default function SessionChart({ points, decimals }) {
  const ref = useRef(null)
  const [hover, setHover] = useState(null)
  const enough = points.length >= 2
  const last = points.at(-1)
  const p = useProgress(last?.ts, 300, enough)
  if (!enough) return <p className="chart-empty">The chart starts with the second price received.</p>

  const prices = points.map((pt) => pt.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const span = max - min || Math.abs(max) * 0.001 || 1
  const t0 = points[0].ts
  const tSpan = last.ts - t0 || 1
  const x = (ts) => ((ts - t0) / tSpan) * W
  const y = (v) => PAD + (1 - (v - min) / span) * (H - PAD * 2)
  const prev = points.at(-2)
  const tipX = x(prev.ts) + (x(last.ts) - x(prev.ts)) * p
  const tipY = y(prev.price) + (y(last.price) - y(prev.price)) * p
  const line = [...points.slice(0, -1).map((pt) => `${x(pt.ts).toFixed(1)},${y(pt.price).toFixed(1)}`), `${tipX.toFixed(1)},${tipY.toFixed(1)}`].join(' ')
  const mid = (min + max) / 2
  const point = hover == null ? null : points[hover]

  const nearest = (clientX) => {
    const box = ref.current.getBoundingClientRect()
    const ts = t0 + ((clientX - box.left) / box.width) * tSpan
    let best = 0
    for (let k = 1; k < points.length; k++) if (Math.abs(points[k].ts - ts) < Math.abs(points[best].ts - ts)) best = k
    return best
  }
  const onKey = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const from = hover ?? points.length - 1
    setHover(Math.min(points.length - 1, Math.max(0, from + (e.key === 'ArrowRight' ? 1 : -1))))
  }

  return (
    <figure className="chart">
      <div
        ref={ref}
        className="chart-plot"
        tabIndex={0}
        role="img"
        aria-label={`Session prices from ${formatPrice(min, decimals)} to ${formatPrice(max, decimals)} USD. Use the arrow keys to read each point.`}
        onPointerMove={(e) => setHover(nearest(e.clientX))}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          {[max, mid, min].map((v, k) => (
            <line key={k} className="chart-grid" x1="0" x2={W} y1={y(v)} y2={y(v)} vectorEffect="non-scaling-stroke" />
          ))}
          <polyline className="chart-line" points={line} vectorEffect="non-scaling-stroke" />
          {point && <line className="chart-cross" x1={x(point.ts)} x2={x(point.ts)} y1="0" y2={H} vectorEffect="non-scaling-stroke" />}
        </svg>
        <span
          className="chart-dot"
          style={point ? { left: `${(x(point.ts) / W) * 100}%`, top: `${(y(point.price) / H) * 100}%` } : { left: `${(tipX / W) * 100}%`, top: `${(tipY / H) * 100}%` }}
          aria-hidden="true"
        />
        {[max, mid, min].map((v, k) => (
          <span key={k} className="chart-tick" style={{ top: `${(y(v) / H) * 100}%` }}>{formatPrice(v, decimals)}</span>
        ))}
        {point && (
          <span className="chart-tip" data-align={align(x(point.ts) / W)} style={{ left: `${(x(point.ts) / W) * 100}%` }} aria-hidden="true">
            <strong>{formatPrice(point.price, decimals)}</strong> {time.format(point.ts)}
          </span>
        )}
        <span className="chart-readout sr-only" aria-live="polite">
          {point ? `${formatPrice(point.price, decimals)} USD at ${time.format(point.ts)}` : ''}
        </span>
      </div>
      <div className="chart-times" aria-hidden="true">
        <span>{clock.format(t0)}</span>
        <span>{clock.format(last.ts)}</span>
      </div>
    </figure>
  )
}
