import Change from './Change.jsx'
import Icon from './Icon.jsx'
import OrderBook from './OrderBook.jsx'
import SessionChart from './SessionChart.jsx'
import { STALE_ROW_MS } from './WatchRow.jsx'
import { ageSeconds, baseSymbol, formatPrice } from '../format.js'

// The selected asset: identity, quote, session chart and market depth.
export default function FocusStage({ symbol, name, ticker, book, bookError, decimals, nowMs, onBack, headingRef }) {
  if (!symbol) {
    return (
      <section className="detail">
        <p className="detail-empty">Pick a coin to see its chart and market depth.</p>
      </section>
    )
  }
  const base = baseSymbol(symbol)
  const stale = ticker && nowMs - ticker.receivedAt > STALE_ROW_MS
  const history = ticker?.history ?? []
  const prev = history.at(-2)?.price
  const tick = ticker && prev != null ? (ticker.last > prev ? 'up' : ticker.last < prev ? 'down' : null) : null
  // A book is shown only for the coin it belongs to, so a focus change never flashes the previous one.
  const ownBook = book?.symbol === symbol ? book : null
  return (
    <section className="detail" aria-labelledby="detail-title">
      {onBack && (
        <button type="button" className="detail-back" onClick={onBack}>
          <Icon name="back" />
          Watchlist
        </button>
      )}
      {/* Keyed by coin: name, quote and chart change together and fade in as one. */}
      <div className="detail-body" key={symbol}>
        <div className="detail-top">
          <div className="detail-head">
            <h2 id="detail-title" className="detail-title" tabIndex={-1} ref={headingRef}>{name ?? base}</h2>
            <p className="detail-sub">{base}/USD perpetual</p>
          </div>
          <div className="detail-quote">
            <p className="detail-price" aria-live="polite">
              {ticker ? (
                <span data-tick={tick ?? undefined} key={ticker.ts}>{formatPrice(ticker.last, decimals)}</span>
              ) : (
                <span className="detail-waiting">Waiting for data</span>
              )}
            </p>
            {ticker && (
              <dl className="detail-facts">
                <div><dt>Mark price</dt><dd>{formatPrice(ticker.mark, decimals)} USD</dd></div>
                <div><dt>24h change</dt><dd><Change pct={ticker.change24hPct} /></dd></div>
                {stale && <div><dt>Last update</dt><dd className="row-age">{ageSeconds(nowMs, ticker.receivedAt)}s ago</dd></div>}
              </dl>
            )}
          </div>
        </div>
        <SessionChart points={history} decimals={decimals} />
        <div className="detail-book">
          <h3 className="detail-subtitle">Market depth</h3>
          <p className="book-error" role="status">{bookError}</p>
          <OrderBook book={ownBook} decimals={decimals} />
        </div>
      </div>
    </section>
  )
}
