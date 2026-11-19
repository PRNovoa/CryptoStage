// Offline demo: MSW answers the exchange socket and the products request with recorded data.
// It never calls server.connect(), so no real exchange connection is opened.
// ponytail: BTC/ETH recordings only; capture more symbols if the demo needs them.
import { http, HttpResponse, ws } from 'msw'
import { DEMO_RECORDINGS, PRODUCTS_SAMPLE } from '../delta/fixtures.js'
import { REST_URL, SOCKET_URL } from '../delta/protocol.js'

const TICK_MS = 5000
const BOOK_MS = 500
const HEARTBEAT_MS = 30000
const RESNAPSHOT_MS = 1000

const connections = new Set()
export const openConnections = () => connections.size

// The next book update on every open connection skips one sequence number.
export function simulateGap() {
  for (const c of connections) c.skipNext = true
}

const clone = (o) => structuredClone(o)

// The recorded updates came after the market moved, so looping them over the old snapshot would
// cross the book. Keep only the recorded levels on each side of the snapshot's spread.
function loopableUpdates({ snapshot, updates }) {
  const bestBid = Math.max(...snapshot.b.map(([p]) => Number(p)))
  const bestAsk = Math.min(...snapshot.a.map(([p]) => Number(p)))
  return updates.map((u) => ({
    ...u,
    b: u.b.filter(([p]) => Number(p) <= bestBid),
    a: u.a.filter(([p]) => Number(p) >= bestAsk),
  }))
}
const nowUs = () => Date.now() * 1000

function onConnection({ client }) {
  const timers = new Map()
  const conn = { skipNext: false, gapped: false }
  const subs = { tickers: new Set(), book: null }
  connections.add(conn)

  const send = (msg) => client.send(JSON.stringify(msg))
  const stop = (key) => {
    clearTimeout(timers.get(key))
    clearInterval(timers.get(key))
    timers.delete(key)
  }

  const startTicker = (sym) => {
    const frames = DEMO_RECORDINGS[sym]?.tickers
    if (!frames || timers.has('t:' + sym)) return
    let i = 0
    const tick = () => send({ ...clone(frames[i++ % frames.length]), ts: nowUs() })
    tick()
    timers.set('t:' + sym, setInterval(tick, TICK_MS))
  }

  const startBook = (sym) => {
    const rec = DEMO_RECORDINGS[sym]
    stop('book')
    if (!rec) return
    const updates = loopableUpdates(rec)
    let seq = rec.snapshot.seq
    let i = 0
    const begin = () => {
      if (subs.book !== sym) return
      conn.gapped = false
      seq = rec.snapshot.seq
      send({ ...clone(rec.snapshot), seq, ts: nowUs() })
      timers.set('book', setInterval(() => {
        seq += conn.skipNext ? 2 : 1
        if (conn.skipNext) conn.gapped = true
        conn.skipNext = false
        send({ ...clone(updates[i++ % updates.length]), seq, ts: nowUs() })
      }, BOOK_MS))
    }
    // After a simulated gap, the replacement snapshot arrives a moment later, like a real reload.
    if (conn.gapped) timers.set('book', setTimeout(begin, RESNAPSHOT_MS))
    else begin()
  }

  client.addEventListener('message', (e) => {
    let msg
    try {
      msg = JSON.parse(e.data)
    } catch {
      return
    }
    if (msg.type === 'enable_heartbeat' && !timers.has('heartbeat')) {
      timers.set('heartbeat', setInterval(() => send({ type: 'heartbeat' }), HEARTBEAT_MS))
    }
    const channels = msg.payload?.channels ?? []
    if (msg.type === 'subscribe') {
      send({ type: 'subscriptions', channels })
      for (const ch of channels) {
        if (ch.name === 'ticker') {
          for (const s of ch.symbols) {
            subs.tickers.add(s)
            startTicker(s)
          }
        }
        if (ch.name === 'ob_updates' && ch.symbols[0]) {
          subs.book = ch.symbols[0]
          startBook(subs.book)
        }
      }
    }
    if (msg.type === 'unsubscribe') {
      for (const ch of channels) {
        if (ch.name === 'ticker') {
          for (const s of ch.symbols) {
            subs.tickers.delete(s)
            stop('t:' + s)
          }
        }
        if (ch.name === 'ob_updates' && ch.symbols.includes(subs.book)) {
          subs.book = null
          stop('book')
        }
      }
    }
  })

  client.addEventListener('close', () => {
    for (const key of [...timers.keys()]) stop(key)
    connections.delete(conn)
  })
}

const recorded = PRODUCTS_SAMPLE.filter((p) => p.symbol in DEMO_RECORDINGS)

export const demoHandlers = [
  ws.link(SOCKET_URL).addEventListener('connection', onConnection),
  http.get(REST_URL + '/v2/products', () => HttpResponse.json({ success: true, result: recorded })),
]
