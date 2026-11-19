import Icon from './Icon.jsx'
import Change from './Change.jsx'
import Sparkline from './Sparkline.jsx'
import { ageSeconds, baseSymbol, formatPrice } from '../format.js'

export const STALE_ROW_MS = 15000

export default function WatchRow({ symbol, name, ticker, decimals, nowMs, selected, onSelect, onRemove }) {
  const history = ticker?.history ?? []
  const prev = history.at(-2)?.price
  const tick = ticker && prev != null ? (ticker.last > prev ? 'up' : ticker.last < prev ? 'down' : null) : null
  const stale = ticker && nowMs - ticker.receivedAt > STALE_ROW_MS
  const base = baseSymbol(symbol)
  return (
    <li className="row" data-symbol={symbol} data-selected={selected || undefined}>
      <button type="button" className="row-select" aria-pressed={selected} onClick={onSelect}>
        <span className="row-name">
          <span className="row-title">{name ?? base}</span>
          <span className="row-ticker">{base}</span>
        </span>
        {/* Under the name, so prices and changes keep their full width. */}
        <Sparkline points={history.slice(-48)} />
        {ticker ? (
          <>
            <span className="row-price" data-tick={tick ?? undefined} key={ticker.ts}>
              {formatPrice(ticker.last, decimals)}
            </span>
            <Change pct={ticker.change24hPct} />
          </>
        ) : (
          <span className="row-waiting">Waiting for data</span>
        )}
        {stale && <span className="row-age">Last update {ageSeconds(nowMs, ticker.receivedAt)}s ago</span>}
      </button>
      <button type="button" className="row-remove" aria-label={`Remove ${symbol}`} onClick={onRemove}>
        <Icon name="remove" />
      </button>
    </li>
  )
}
