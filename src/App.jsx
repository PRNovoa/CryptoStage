import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useDelta } from './delta/useDelta.js'
import { decimalsFromTick, isCryptoPerp, REST_URL } from './delta/protocol.js'
import { loadWatchlist, saveWatchlist } from './watchlist.js'
import StatusPill from './components/StatusPill.jsx'
import WatchRow from './components/WatchRow.jsx'
import CoinPicker from './components/CoinPicker.jsx'
import FocusStage from './components/FocusStage.jsx'
import Preferences from './components/Preferences.jsx'
import { applyPrefs, loadPref, MOTION, savePref, THEME } from './prefs.js'

const DEMO_COINS = ['BTCUSD', 'ETHUSD']
const PRODUCTS_URL = REST_URL + '/v2/products?contract_types=perpetual_futures&states=live'
const PHONE = '(max-width: 1023px)' // below this, list and detail are separate views

function usePhone() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(PHONE)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia(PHONE).matches,
  )
}

export default function App({ onSimulateGap }) {
  const [demo] = useState(() => new URLSearchParams(window.location.search).get('demo') === '1')
  const [watchlist, setWatchlist] = useState(() => (demo ? DEMO_COINS : loadWatchlist()))
  const [focus, setFocus] = useState(() => watchlist[0] ?? null)
  const [products, setProducts] = useState(undefined) // undefined = loading, null = failed
  const [view, setView] = useState('list') // narrow screens show one view at a time
  const [theme, setTheme] = useState(() => loadPref(THEME))
  const [motion, setMotion] = useState(() => loadPref(MOTION))
  const phone = usePhone()
  const { status, nowMs, lastMessageAt, retryInMs, tickers, book, bookError, dropNow } = useDelta(watchlist, focus)
  const headingRef = useRef(null)
  const focusAfterRemove = useRef(null)
  const focusAfterView = useRef(null)

  useEffect(() => {
    if (!demo) saveWatchlist(watchlist)
  }, [demo, watchlist])

  const chooseTheme = (t) => {
    setTheme(t)
    savePref(THEME, t)
    applyPrefs({ theme: t, motion })
  }
  const chooseMotion = (m) => {
    setMotion(m)
    savePref(MOTION, m)
    applyPrefs({ theme, motion: m })
  }

  useEffect(() => {
    let cancelled = false
    fetch(PRODUCTS_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then((body) => !cancelled && setProducts(body.result.filter(isCryptoPerp)))
      .catch(() => !cancelled && setProducts(null))
    return () => {
      cancelled = true
    }
  }, [])

  // The phone detail view is a history entry, so the browser's back button returns to the list.
  useEffect(() => {
    if (view !== 'detail') return
    const onPop = () => {
      focusAfterView.current = 'row'
      setView('list')
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [view])

  useEffect(() => {
    const target = focusAfterView.current
    focusAfterView.current = null
    if (target === 'heading') {
      window.scrollTo(0, 0)
      headingRef.current?.focus({ preventScroll: true })
    }
    if (target === 'row') document.querySelector(`[data-symbol="${focus}"] .row-select`)?.focus()
  }, [view, focus])

  useEffect(() => {
    const target = focusAfterRemove.current
    if (!target) return
    focusAfterRemove.current = null
    const el = target === 'title' ? document.getElementById('watch-title') : document.querySelector(`[data-symbol="${target}"] .row-select`)
    el?.focus()
  }, [watchlist])

  const info = useMemo(() => {
    const map = {}
    for (const p of products ?? []) map[p.symbol] = { decimals: decimalsFromTick(p.tick_size), name: p.underlying_asset?.name }
    return map
  }, [products])
  const dec = (s) => info[s]?.decimals ?? 2

  const select = (symbol) => {
    setFocus(symbol)
    if (!phone) return
    window.history.pushState({ cryptostage: 'detail' }, '')
    focusAfterView.current = 'heading'
    setView('detail')
  }
  const back = () => window.history.back()
  const remove = (symbol) => {
    const i = watchlist.indexOf(symbol)
    const next = watchlist.filter((s) => s !== symbol)
    setWatchlist(next)
    if (focus === symbol) setFocus(next[0] ?? null)
    // The pressed button disappears, so keyboard focus moves to the row that takes its place.
    focusAfterRemove.current = next[Math.min(i, next.length - 1)] ?? 'title'
  }
  const add = (symbol) => {
    setWatchlist([...watchlist, symbol])
    if (!focus) setFocus(symbol)
  }

  const liveHref = window.location.pathname
  const gapBlocked = !book ? 'Available once the order book loads.' : bookError ? 'Waiting for the order book to recover.' : null
  const shown = phone ? view : 'both'

  return (
    <div className="app">
      <a className="skip" href="#watch-title">Skip to watchlist</a>
      <h1 className="sr-only">CryptoStage</h1>

      <main className="board" data-view={shown}>
        <section className="watch" aria-labelledby="watch-title" inert={shown === 'detail' || undefined}>
          <div className="watch-head">
            <h2 id="watch-title" className="watch-title" tabIndex={-1}>Watchlist</h2>
          </div>
          <StatusPill status={status} nowMs={nowMs} lastMessageAt={lastMessageAt} retryInMs={retryInMs} />
          <CoinPicker products={products} watchlist={watchlist} onAdd={add} />
          {watchlist.length ? (
            <ul className="rows">
              {watchlist.map((s) => (
                <WatchRow
                  key={s}
                  symbol={s}
                  name={info[s]?.name}
                  ticker={tickers[s]}
                  decimals={dec(s)}
                  nowMs={nowMs}
                  selected={s === focus}
                  onSelect={() => select(s)}
                  onRemove={() => remove(s)}
                />
              ))}
            </ul>
          ) : (
            <p className="watch-empty">Your watchlist is empty. Add a coin to start streaming.</p>
          )}
        </section>
        <div className="detail-slot" inert={shown === 'list' || undefined}>
          <FocusStage
            symbol={focus}
            name={focus ? info[focus]?.name : undefined}
            ticker={focus ? tickers[focus] : undefined}
            book={book}
            bookError={bookError}
            decimals={focus ? dec(focus) : 2}
            nowMs={nowMs}
            onBack={phone ? back : undefined}
            headingRef={headingRef}
          />
        </div>
      </main>

      <footer className="utility">
        <p className="utility-name">CryptoStage</p>
        <Preferences theme={theme} motion={motion} onTheme={chooseTheme} onMotion={chooseMotion} />
        <div className="demo-controls" role="group" aria-label="Demo controls">
          {demo && <span className="demo-label">Demo data</span>}
          {demo && (
            <span className="gap-control">
              <button type="button" onClick={onSimulateGap} disabled={Boolean(gapBlocked)} aria-describedby={gapBlocked ? 'gap-why' : undefined}>
                Simulate gap
              </button>
              {gapBlocked && <span id="gap-why" className="control-note">{gapBlocked}</span>}
            </span>
          )}
          <button type="button" onClick={dropNow} disabled={status === 'reconnecting' || status === 'connecting'}>
            Simulate drop
          </button>
          <a className="mode-link" href={demo ? liveHref : liveHref + '?demo=1'}>
            {demo ? 'Use live data' : 'Use demo data'}
          </a>
        </div>
      </footer>
    </div>
  )
}
