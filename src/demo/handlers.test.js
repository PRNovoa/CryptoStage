import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { server } from '../test-setup.js'
import { DEMO_RECORDINGS, PRODUCTS_SAMPLE } from '../delta/fixtures.js'
import { REST_URL, SOCKET_URL, subscribeMsg, unsubscribeMsg } from '../delta/protocol.js'
import { demoHandlers, openConnections, simulateGap } from './handlers.js'
import { applyBook, EMPTY_BOOK_STATE, topLevels } from '../delta/book.js'

const before = JSON.stringify(DEMO_RECORDINGS)
let sock, got
const frames = (pred = () => true) => got.filter(pred)
const book = (m) => m.type === 'ob_updates'

async function open() {
  sock = new WebSocket(SOCKET_URL)
  got = []
  sock.addEventListener('message', (e) => got.push(JSON.parse(e.data)))
  await vi.advanceTimersByTimeAsync(0)
}

beforeEach(() => {
  vi.useFakeTimers()
  server.use(...demoHandlers)
})
afterEach(() => {
  sock?.close()
  vi.useRealTimers()
})

test('subscribe gets an ack and data only for requested symbols', async () => {
  await open()
  sock.send(subscribeMsg([{ name: 'ticker', symbols: ['BTCUSD'] }, { name: 'ob_updates', symbols: ['ETHUSD'] }]))
  await vi.advanceTimersByTimeAsync(10_000)
  expect(got[0].type).toBe('subscriptions')
  expect(new Set(frames((m) => m.type === 'ticker').map((m) => m.sy))).toEqual(new Set(['BTCUSD']))
  expect(frames((m) => m.type === 'ticker')).toHaveLength(3) // t=0, 5 s, 10 s
  const ob = frames(book)
  expect(ob[0].action).toBe('snapshot')
  expect(new Set(ob.map((m) => m.sy))).toEqual(new Set(['ETHUSD']))
  ob.slice(1).forEach((m, i) => expect(m.seq).toBe(ob[0].seq + i + 1))
  expect(JSON.stringify(DEMO_RECORDINGS)).toBe(before)
})

test('unsubscribe stops its stream and a delayed old-symbol snapshot', async () => {
  await open()
  const ch = [{ name: 'ob_updates', symbols: ['BTCUSD'] }]
  sock.send(subscribeMsg(ch))
  await vi.advanceTimersByTimeAsync(1000)
  simulateGap()
  await vi.advanceTimersByTimeAsync(500)
  sock.send(unsubscribeMsg(ch))
  sock.send(subscribeMsg(ch)) // the replacement snapshot is now queued for 1 s
  await vi.advanceTimersByTimeAsync(100)
  sock.send(unsubscribeMsg(ch))
  const n = frames(book).length
  await vi.advanceTimersByTimeAsync(5000)
  expect(frames(book)).toHaveLength(n)
})

test('simulateGap skips exactly one seq and a resubscribe gets a snapshot 1s later', async () => {
  await open()
  const ch = [{ name: 'ob_updates', symbols: ['BTCUSD'] }]
  sock.send(subscribeMsg(ch))
  await vi.advanceTimersByTimeAsync(1000)
  simulateGap()
  await vi.advanceTimersByTimeAsync(1000)
  const seqs = frames(book).filter((m) => m.action === 'update').map((m) => m.seq)
  const jumps = seqs.slice(1).map((s, i) => s - seqs[i])
  expect(jumps.filter((j) => j === 2)).toHaveLength(1)
  expect(jumps.every((j) => j === 1 || j === 2)).toBe(true)
  sock.send(unsubscribeMsg(ch))
  sock.send(subscribeMsg(ch))
  const n = frames(book).length
  await vi.advanceTimersByTimeAsync(999)
  expect(frames(book)).toHaveLength(n)
  await vi.advanceTimersByTimeAsync(1)
  expect(frames(book).at(-1).action).toBe('snapshot')
  await vi.advanceTimersByTimeAsync(1500)
  const after = frames(book).slice(n)
  after.slice(1).forEach((m, i) => expect(m.seq).toBe(after[0].seq + i + 1))
})

test('client close leaves no timers or retained connections', async () => {
  await open()
  sock.send(JSON.stringify({ type: 'enable_heartbeat' }))
  sock.send(subscribeMsg([{ name: 'ticker', symbols: ['BTCUSD', 'ETHUSD'] }, { name: 'ob_updates', symbols: ['BTCUSD'] }]))
  await vi.advanceTimersByTimeAsync(31_000)
  expect(frames((m) => m.type === 'heartbeat')).toHaveLength(1)
  sock.close()
  await vi.advanceTimersByTimeAsync(0)
  expect(openConnections()).toBe(0)
  expect(vi.getTimerCount()).toBe(0)
})

test('products route returns only recorded coins', async () => {
  vi.useRealTimers()
  const res = await fetch(REST_URL + '/v2/products?contract_types=perpetual_futures&states=live')
  const body = await res.json()
  expect(body.success).toBe(true)
  expect(body.result.map((p) => p.symbol).sort()).toEqual(['BTCUSD', 'ETHUSD'])
  expect(body.result[0]).toEqual(PRODUCTS_SAMPLE.find((p) => p.symbol === body.result[0].symbol))
})

test('looped replay never crosses the book', async () => {
  await open()
  sock.send(subscribeMsg([{ name: 'ob_updates', symbols: ['BTCUSD'] }]))
  await vi.advanceTimersByTimeAsync(20_000)
  let state = EMPTY_BOOK_STATE
  for (const m of frames(book)) {
    state = applyBook(state, m, 'BTCUSD').state
    const { bids, asks } = topLevels(state.book, 1)
    expect(Number(bids[0][0])).toBeLessThan(Number(asks[0][0]))
  }
})
