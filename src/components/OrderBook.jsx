import { useMemo, useRef, useState } from 'react'
import { cumulativeDepth } from '../delta/book.js'
import { formatPrice } from '../format.js'

const W = 600
const H = 160
const usd = (v, d) => (v == null ? 'Unavailable' : `${formatPrice(v, d)} USD`)
const contracts = (n) => `${n.toLocaleString('en-US')} contract${n === 1 ? '' : 's'}`

// Stepped cumulative depth at the real price levels: each step holds until the next level, and the
// shape stops at the last level shown instead of trailing off into liquidity that isn't in view.
function stepPath(levels, x, y) {
  if (!levels.length) return ''
  let d = `M${x(levels[0].price).toFixed(1)},${H} `
  levels.forEach((l, i) => {
    d += `L${x(l.price).toFixed(1)},${y(i ? levels[i - 1].cum : 0).toFixed(1)} L${x(l.price).toFixed(1)},${y(l.cum).toFixed(1)} `
  })
  return d + `L${x(levels.at(-1).price).toFixed(1)},${H} Z`
}

function Levels({ caption, levels, decimals }) {
  return (
    <table className="levels">
      <caption>{caption}</caption>
      <thead>
        <tr><th scope="col">Price (USD)</th><th scope="col">Size (contracts)</th></tr>
      </thead>
      <tbody>
        {levels.slice(0, 5).map((l) => (
          <tr key={l.price}><td>{formatPrice(l.price, decimals)}</td><td>{l.size.toLocaleString('en-US')}</td></tr>
        ))}
      </tbody>
    </table>
  )
}

export default function OrderBook({ book, decimals }) {
  const depth = useMemo(() => (book ? cumulativeDepth(book, 10) : null), [book])
  const [active, setActive] = useState(null)
  const ref = useRef(null)
  if (!depth) return <p className="book-empty">Loading the order book…</p>
  if (!depth.bids.length && !depth.asks.length) return <p className="book-empty">The order book has no levels right now.</p>

  const { bids, asks, low, high, maxCum } = depth
  const levels = [...[...bids].reverse().map((l) => ({ ...l, side: 'Bid' })), ...asks.map((l) => ({ ...l, side: 'Ask' }))]
  const span = high - low || 1
  const x = (p) => ((p - low) / span) * W
  const y = (c) => H - (maxCum ? (c / maxCum) * (H - 8) : 0)
  const pick = levels[active] ?? null

  const onKey = (e) => {
    const last = levels.length - 1
    const next = { ArrowRight: (active ?? -1) + 1, ArrowLeft: (active ?? levels.length) - 1, Home: 0, End: last }[e.key]
    if (next == null || last < 0) return
    e.preventDefault()
    setActive(Math.min(last, Math.max(0, next)))
  }
  const onPointer = (e) => {
    const box = ref.current.getBoundingClientRect()
    const price = low + ((e.clientX - box.left) / box.width) * span
    let best = 0
    levels.forEach((l, i) => { if (Math.abs(l.price - price) < Math.abs(levels[best].price - price)) best = i })
    setActive(levels.length ? best : null)
  }

  return (
    <div className="depth">
      <dl className="depth-summary" role="group" aria-label="Book summary">
        <div><dt>Best bid</dt><dd className="bid">{usd(depth.bestBid, decimals)}</dd></div>
        <div><dt>Spread</dt><dd>{usd(depth.spread, decimals)}</dd></div>
        <div><dt>Best ask</dt><dd className="ask">{usd(depth.bestAsk, decimals)}</dd></div>
      </dl>
      <div className="depth-figure">
        <div className="depth-y" aria-hidden="true">
          <span>{maxCum.toLocaleString('en-US')}</span>
          <span className="depth-axis-name">Cumulative contracts</span>
          <span>0</span>
        </div>
        <div
          ref={ref}
          className="depth-plot"
          role="img"
          tabIndex={0}
          aria-label="Market depth. Use the arrow keys to read each level."
          onKeyDown={onKey}
          onPointerMove={onPointer}
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
        >
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
            <line className="depth-base" x1="0" x2={W} y1={H} y2={H} vectorEffect="non-scaling-stroke" />
            <path className="depth-bids" d={stepPath(bids, x, y)} style={{ d: `path('${stepPath(bids, x, y)}')` }} vectorEffect="non-scaling-stroke" />
            <path className="depth-asks" d={stepPath(asks, x, y)} style={{ d: `path('${stepPath(asks, x, y)}')` }} vectorEffect="non-scaling-stroke" />
            {pick && <line className="depth-cross" x1={x(pick.price)} x2={x(pick.price)} y1="0" y2={H} vectorEffect="non-scaling-stroke" />}
          </svg>
          {bids.length > 0 && <span className="depth-side" data-side="bids" aria-hidden="true">Bids</span>}
          {asks.length > 0 && <span className="depth-side" data-side="asks" aria-hidden="true">Asks</span>}
        </div>
        <div className="depth-x" aria-hidden="true">
          <span>{formatPrice(low, decimals)}</span>
          <span className="depth-axis-name">Price (USD)</span>
          <span>{formatPrice(high, decimals)}</span>
        </div>
        <p className="depth-readout" data-testid="depth-readout" aria-live="polite">
          {pick ? `${pick.side} at ${formatPrice(pick.price, decimals)} USD: ${contracts(pick.cum)} cumulative` : ''}
        </p>
        <p className="depth-range">
          Cumulative depth of the nearest {bids.length} bid and {asks.length} ask levels, {formatPrice(low, decimals)} to {formatPrice(high, decimals)} USD
        </p>
      </div>
      <details className="levels-disclosure">
        <summary>Price levels</summary>
        <div className="levels-pair">
          <Levels caption="Bids" levels={bids} decimals={decimals} />
          <Levels caption="Asks" levels={asks} decimals={decimals} />
        </div>
      </details>
    </div>
  )
}
