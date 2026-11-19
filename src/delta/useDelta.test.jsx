import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { ws } from 'msw'
import { server } from '../test-setup.js'
import { SOCKET_URL } from './protocol.js'
import { useDelta } from './useDelta.js'

const HEARTBEAT_ON = { type: 'enable_heartbeat' }
const ticker = (sy, last) => ({ type: 'ticker', sy, ts: Date.now() * 1000, d: [{ s: sy, m: String(last), ohlc: [last, last, last, last] }] })
const snap = (seq, sy = 'BTCUSD') => ({ type: 'ob_updates', action: 'snapshot', sy, seq, a: [['101', '5']], b: [['100', '4']] })
const upd = (seq, sy = 'BTCUSD') => ({ type: 'ob_updates', action: 'update', sy, seq, a: [['101', '6']], b: [] })
const ERROR = { action: 'error', symbol: 'BTCUSD', type: 'ob_updates', msg: 'Snapshot load failed. Verify if product is live and resubscribe after a few secs.' }

let conns
function mockDelta(onConnect) {
  conns = []
  const link = ws.link(SOCKET_URL)
  server.use(
    link.addEventListener('connection', ({ client }) => {
      const c = { client, sent: [], at: Date.now() }
      client.addEventListener('message', (e) => c.sent.push(JSON.parse(e.data)))
      conns.push(c)
      onConnect?.(c)
    }),
  )
}
const send = (msg, c = conns.at(-1)) => act(async () => { c.client.send(JSON.stringify(msg)); await vi.advanceTimersByTimeAsync(0) })
const advance = (ms) => act(() => vi.advanceTimersByTimeAsync(ms))
const allSent = () => conns.flatMap((c) => c.sent)
const bookSubs = (sy = 'BTCUSD', type = 'subscribe') =>
  allSent().filter((m) => m.type === type && m.payload.channels.some((ch) => ch.name === 'ob_updates' && ch.symbols.includes(sy))).length

async function start(symbols = ['BTCUSD', 'ETHUSD'], focus = 'BTCUSD') {
  const hook = renderHook(({ symbols, focus }) => useDelta(symbols, focus), { initialProps: { symbols, focus } })
  await advance(0)
  return hook
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
  mockDelta()
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

test('subscribes watchlist and focus on open', async () => {
  const { result } = await start()
  expect(conns[0].sent).toEqual([
    HEARTBEAT_ON,
    { type: 'subscribe', payload: { channels: [{ name: 'ticker', symbols: ['BTCUSD', 'ETHUSD'] }, { name: 'ob_updates', symbols: ['BTCUSD'] }] } },
  ])
  expect(result.current.status).toBe('live')
})

test('keeps last prices while reconnecting, then resubscribes', async () => {
  const { result } = await start()
  await send(ticker('BTCUSD', 100))
  await act(async () => { conns[0].client.close(1006, 'gone'); await vi.advanceTimersByTimeAsync(0) })
  expect(result.current.status).toBe('reconnecting')
  expect(result.current.tickers.BTCUSD.last).toBe(100)
  await advance(1000)
  expect(conns).toHaveLength(2)
  expect(conns[1].sent[1].payload.channels[0]).toEqual({ name: 'ticker', symbols: ['BTCUSD', 'ETHUSD'] })
  expect(result.current.status).toBe('live')
  expect(result.current.tickers.BTCUSD.last).toBe(100)
})

test('diff-subscribes when a coin is added or removed', async () => {
  const { rerender } = await start()
  rerender({ symbols: ['BTCUSD', 'ETHUSD', 'SOLUSD'], focus: 'BTCUSD' })
  await advance(0)
  expect(conns[0].sent.at(-1)).toEqual({ type: 'subscribe', payload: { channels: [{ name: 'ticker', symbols: ['SOLUSD'] }] } })
  rerender({ symbols: ['BTCUSD', 'SOLUSD'], focus: 'BTCUSD' })
  await advance(0)
  expect(conns[0].sent.at(-1)).toEqual({ type: 'unsubscribe', payload: { channels: [{ name: 'ticker', symbols: ['ETHUSD'] }] } })
  expect(conns).toHaveLength(1)
})

test('removing focused coin unsubscribes its book', async () => {
  const { rerender } = await start()
  rerender({ symbols: ['ETHUSD'], focus: 'ETHUSD' })
  await advance(0)
  expect(bookSubs('BTCUSD', 'unsubscribe')).toBe(1)
  expect(bookSubs('ETHUSD')).toBe(1)
})

test('empty watchlist sends no ticker subscribe', async () => {
  await start([], null)
  expect(conns[0].sent).toEqual([HEARTBEAT_ON])
})

test('watchdog reconnects after 35s of silence', async () => {
  const { result } = await start()
  await advance(34000)
  expect(conns).toHaveLength(1)
  await advance(1000)
  expect(result.current.status).toBe('reconnecting')
  await advance(1000)
  expect(conns).toHaveLength(2)
})

test('watchdog reconnects even when a dead network never delivers the close event', async () => {
  // MSW swaps in its own WebSocket class, so take the prototype from a throwaway socket.
  const probe = new WebSocket(SOCKET_URL)
  const proto = Object.getPrototypeOf(probe)
  probe.close()
  await advance(0)
  conns.length = 0
  const { result } = await start()
  vi.spyOn(proto, 'close').mockImplementation(() => {}) // the closing handshake never completes
  await advance(35000)
  expect(result.current.status).toBe('reconnecting')
  await advance(1000)
  expect(conns).toHaveLength(2)
})

test('a connection attempt that never opens is retired by the watchdog', async () => {
  const made = []
  class NeverOpens extends EventTarget {
    static OPEN = 1
    readyState = 0
    constructor() { super(); made.push(this) }
    send() {}
    close() {} // a dead network never finishes the handshake either way
  }
  vi.stubGlobal('WebSocket', NeverOpens)
  const { result } = await start()
  expect(result.current.status).toBe('connecting')
  await advance(35000)
  expect(result.current.status).toBe('reconnecting')
  await advance(1000)
  expect(made.length).toBeGreaterThanOrEqual(2)
  expect(result.current.status).toBe('connecting')
})

test('a gap whose snapshot never comes is retried every 3s', async () => {
  await start()
  await send(snap(10))
  await send(upd(12))
  expect(bookSubs()).toBe(2)
  await advance(3000)
  expect(bookSubs()).toBe(3)
  await advance(3000)
  expect(bookSubs()).toBe(4)
})

test('gap triggers exactly one ob resubscribe for several later updates and keeps book', async () => {
  const { result } = await start()
  await send(snap(10))
  for (const seq of [12, 13, 14, 15]) await send(upd(seq))
  expect(bookSubs('BTCUSD', 'unsubscribe')).toBe(1)
  expect(bookSubs('BTCUSD')).toBe(2)
  expect(result.current.book.asks.get('101')).toBe(5)
  expect(result.current.bookError).toBe('Order book out of sync, reloading…')
})

test('recovery error retries after 3s, then a snapshot clears the error message and stops retrying', async () => {
  const { result } = await start()
  await send(snap(10))
  await send(upd(12))
  await send(ERROR)
  expect(bookSubs()).toBe(2)
  await advance(2999)
  expect(bookSubs()).toBe(2)
  await advance(1)
  expect(bookSubs()).toBe(3)
  await send(snap(40))
  expect(result.current.bookError).toBeNull()
  await advance(10000)
  expect(bookSubs()).toBe(3)
})

test('error followed by a snapshot before 3s cancels the reload and sends no extra subscription', async () => {
  const { result } = await start()
  await send(snap(10))
  await send(ERROR)
  await advance(1000)
  await send(snap(20))
  await advance(5000)
  expect(bookSubs()).toBe(1)
  expect(result.current.bookError).toBeNull()
})

test('a silent BTC ticker retains receivedAt while ETH and heartbeats continue, and the shared clock advances past 15s', async () => {
  const { result } = await start()
  await send(ticker('BTCUSD', 100))
  const btcAt = result.current.tickers.BTCUSD.receivedAt
  for (let i = 0; i < 4; i++) {
    await advance(5000)
    await send(ticker('ETHUSD', 50))
  }
  await send({ type: 'heartbeat' })
  expect(result.current.tickers.BTCUSD.receivedAt).toBe(btcAt)
  expect(result.current.nowMs - btcAt).toBeGreaterThan(15000)
  expect(result.current.status).toBe('live')
})

test('an unchanged-price ticker refreshes receivedAt', async () => {
  const { result } = await start()
  await send(ticker('BTCUSD', 100))
  const first = result.current.tickers.BTCUSD.receivedAt
  await advance(5000)
  await send(ticker('BTCUSD', 100))
  expect(result.current.tickers.BTCUSD.receivedAt).toBe(first + 5000)
  expect(result.current.tickers.BTCUSD.history).toHaveLength(2)
})

test('status turns stale when no watched coin ticks for 15s', async () => {
  const { result } = await start()
  await send(ticker('BTCUSD', 100))
  await advance(16000)
  expect(result.current.status).toBe('stale')
})

test('focus change drops old book and ignores late old-symbol frames', async () => {
  const { result, rerender } = await start()
  await send(snap(10))
  rerender({ symbols: ['BTCUSD', 'ETHUSD'], focus: 'ETHUSD' })
  await advance(0)
  expect(result.current.book).toBeNull()
  await send(upd(11))
  await send(upd(13))
  expect(result.current.book).toBeNull()
  expect(bookSubs('BTCUSD')).toBe(1)
})

test('focus change cancels a pending 3s error recovery', async () => {
  const { rerender } = await start()
  await send(snap(10))
  await send(ERROR)
  rerender({ symbols: ['BTCUSD', 'ETHUSD'], focus: 'ETHUSD' })
  await advance(5000)
  expect(bookSubs('BTCUSD')).toBe(1)
})

test('open → ack → close cycles keep increasing the delay', async () => {
  server.resetHandlers() // replace the default handler so each connection is recorded once
  mockDelta((c) => {
    setTimeout(() => {
      c.client.send(JSON.stringify({ type: 'subscriptions', channels: [] }))
      c.client.close(1006, 'flaky')
    }, 10)
  })
  await start()
  await advance(60000)
  const gaps = conns.slice(1, 4).map((c, i) => c.at - conns[i].at)
  expect(gaps[1]).toBeGreaterThan(gaps[0])
  expect(gaps[2]).toBeGreaterThan(gaps[1])
})

test('empty watchlist with heartbeats every 30s stays live', async () => {
  const { result } = await start([], null)
  for (let i = 0; i < 3; i++) {
    await advance(30000)
    await send({ type: 'heartbeat' })
  }
  expect(result.current.status).toBe('live')
  expect(conns).toHaveLength(1)
})

test('closes socket on unmount and never reconnects, with no shared clock interval left running', async () => {
  const { unmount } = await start()
  unmount()
  await advance(60000)
  expect(conns).toHaveLength(1)
  expect(vi.getTimerCount()).toBe(0)
})
