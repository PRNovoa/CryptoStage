import { useEffect, useRef, useState } from 'react'
import { applyBook, EMPTY_BOOK_STATE } from './book.js'
import { backoffMs, parseTicker, SOCKET_URL, subscribeMsg, unsubscribeMsg } from './protocol.js'

const STABLE_MS = 10000 // a connection must last this long before the backoff resets
const WATCHDOG_MS = 35000 // Delta heartbeats every 30 s; 5 s of slack
const STALE_MS = 15000
const ERROR_RETRY_MS = 3000
const HISTORY = 300
export const BOOK_ERROR = 'Order book out of sync, reloading…'

// One socket for the whole page: tickers for the watchlist, ob_updates for the focused coin.
export function useDelta(symbols, focus) {
  const [conn, setConn] = useState({ status: 'connecting', retryAt: null, openedAt: null })
  const [lastMessageAt, setLastMessageAt] = useState(null)
  const [tickers, setTickers] = useState({})
  const [bookState, setBookState] = useState(EMPTY_BOOK_STATE)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const wsRef = useRef(null)
  const want = useRef({ symbols, focus })
  const subscribed = useRef({ tickers: new Set(), book: null })
  const bookRef = useRef(EMPTY_BOOK_STATE)
  const timers = useRef({})
  const retire = useRef(() => {})
  want.current = { symbols, focus }

  const clear = (name) => {
    clearTimeout(timers.current[name])
    delete timers.current[name]
  }
  const setBook = (state) => {
    bookRef.current = state
    setBookState(state)
  }
  const isOpen = () => wsRef.current?.readyState === WebSocket.OPEN

  // Send only the difference between what the socket has and what the page wants.
  const sync = () => {
    if (!isOpen()) return
    const have = subscribed.current
    const { symbols: syms, focus: f } = want.current
    const next = new Set(syms)
    const add = [...next].filter((s) => !have.tickers.has(s))
    const drop = [...have.tickers].filter((s) => !next.has(s))
    const off = [], on = []
    if (drop.length) off.push({ name: 'ticker', symbols: drop })
    if (have.book && have.book !== f) off.push({ name: 'ob_updates', symbols: [have.book] })
    if (add.length) on.push({ name: 'ticker', symbols: add })
    if (f && have.book !== f) on.push({ name: 'ob_updates', symbols: [f] })
    if (off.length) wsRef.current.send(unsubscribeMsg(off))
    if (on.length) wsRef.current.send(subscribeMsg(on))
    subscribed.current = { tickers: next, book: f }
  }

  const resubscribeBook = (sym) => {
    if (!isOpen() || want.current.focus !== sym) return
    const ch = [{ name: 'ob_updates', symbols: [sym] }]
    wsRef.current.send(unsubscribeMsg(ch))
    wsRef.current.send(subscribeMsg(ch))
  }

  const onBookFrame = (msg) => {
    const f = want.current.focus
    const { state, resync } = applyBook(bookRef.current, msg, f)
    if (state === bookRef.current) return
    setBook(state)
    if (!state.pending) clear('reload')
    if (resync === 'now') resubscribeBook(f)
    if (resync !== 'none') retryBookIn(f, ERROR_RETRY_MS)
  }

  // While the book waits for a snapshot, ask again every 3 s; one timer at a time.
  const retryBookIn = (sym, ms) => {
    clear('reload')
    timers.current.reload = setTimeout(() => {
      delete timers.current.reload
      if (!bookRef.current.pending || want.current.focus !== sym) return
      resubscribeBook(sym)
      retryBookIn(sym, ms)
    }, ms)
  }

  const onTicker = (msg) => {
    const t = parseTicker(msg)
    if (!t) return
    const receivedAt = Date.now()
    setTickers((prev) => ({
      ...prev,
      [t.symbol]: { ...t, receivedAt, history: [...(prev[t.symbol]?.history ?? []), { price: t.last, ts: t.ts }].slice(-HISTORY) },
    }))
  }

  // Sync subscriptions whenever the watchlist or the focus changes.
  const symbolsKey = symbols.join(',')
  const prevFocus = useRef(focus)
  useEffect(() => {
    if (prevFocus.current !== focus) {
      prevFocus.current = focus
      clear('reload')
      setBook(EMPTY_BOOK_STATE)
    }
    sync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey, focus])

  useEffect(() => {
    let attempt = 0
    let alive = true
    const t = timers.current

    const armWatchdog = () => {
      clear('watchdog')
      t.watchdog = setTimeout(() => retire.current(wsRef.current), WATCHDOG_MS)
    }

    const connect = () => {
      const ws = new WebSocket(SOCKET_URL)
      wsRef.current = ws
      // A dead network can leave an attempt connecting for minutes; the watchdog retires it too.
      armWatchdog()
      setConn({ status: 'connecting', retryAt: null, openedAt: null })
      ws.addEventListener('open', () => {
        subscribed.current = { tickers: new Set(), book: null }
        ws.send(JSON.stringify({ type: 'enable_heartbeat' }))
        sync()
        t.stable = setTimeout(() => { attempt = 0 }, STABLE_MS)
        armWatchdog()
        setConn({ status: 'live', retryAt: null, openedAt: Date.now() })
      })
      ws.addEventListener('message', (e) => {
        if (wsRef.current !== ws) return
        armWatchdog()
        setLastMessageAt(Date.now())
        let msg
        try {
          msg = JSON.parse(e.data)
        } catch {
          return
        }
        if (msg.type === 'ticker') onTicker(msg)
        else if (msg.type === 'ob_updates') onBookFrame(msg)
      })
      ws.addEventListener('close', () => lost(ws))
    }

    // Runs once per socket, from its close event or from retire(), whichever comes first.
    const lost = (ws) => {
      if (!alive || wsRef.current !== ws) return
      wsRef.current = null
      for (const name of ['stable', 'watchdog', 'reload', 'retry']) clear(name)
      // Keep the last good book; it waits for the snapshot the resubscribe brings.
      if (bookRef.current.book || bookRef.current.pending) setBook({ ...bookRef.current, pending: true })
      const delay = backoffMs(attempt++)
      setConn({ status: 'reconnecting', retryAt: Date.now() + delay, openedAt: null })
      t.retry = setTimeout(connect, delay)
    }
    // On a dead network the close handshake can hang, so don't wait for the close event to reconnect.
    retire.current = (ws) => {
      if (!ws) return
      lost(ws)
      ws.close()
    }

    connect()
    const clock = setInterval(() => setNowMs(Date.now()), 1000)
    return () => {
      alive = false
      clearInterval(clock)
      for (const name of Object.keys(t)) clear(name)
      wsRef.current?.close()
      wsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const newest = Math.max(conn.openedAt ?? 0, ...symbols.map((s) => tickers[s]?.receivedAt ?? 0))
  const stale = conn.status === 'live' && symbols.length > 0 && nowMs - newest > STALE_MS
  return {
    status: stale ? 'stale' : conn.status,
    nowMs,
    lastMessageAt,
    retryInMs: conn.retryAt ? Math.max(0, conn.retryAt - nowMs) : null,
    tickers,
    book: bookState.book,
    bookError: bookState.pending ? BOOK_ERROR : null,
    dropNow: () => retire.current(wsRef.current),
  }
}
