import { expect, test } from 'vitest'
import { TICKER_BTC, PRODUCTS_SAMPLE } from './fixtures.js'
import { backoffMs, decimalsFromTick, isCryptoPerp, parseTicker, subscribeMsg, unsubscribeMsg } from './protocol.js'

test('parseTicker reads compact frame', () => {
  expect(parseTicker(TICKER_BTC)).toMatchObject({ symbol: 'BTCUSD', last: TICKER_BTC.d[0].ohlc[3] })
  expect(parseTicker({ type: 'heartbeat' })).toBeNull()
})

test('parseTicker derives the 24h change from the shown price', () => {
  const t = parseTicker(TICKER_BTC)
  const [open, , , last] = TICKER_BTC.d[0].ohlc
  expect(t.open24h).toBe(open)
  expect(t.mark).toBe(Number(TICKER_BTC.d[0].m))
  expect(t.change24hPct).toBeCloseTo(((last - open) / open) * 100, 10)
})

test('parseTicker converts microseconds to ms', () => {
  expect(parseTicker(TICKER_BTC).ts).toBe(Math.floor(TICKER_BTC.ts / 1000))
})

test('isCryptoPerp drops both stock families but keeps BNB and ARB', () => {
  const kept = PRODUCTS_SAMPLE.filter(isCryptoPerp).map((p) => p.symbol)
  expect(kept).toEqual(expect.arrayContaining(['BTCUSD', 'BNBUSD', 'ARBUSD']))
  expect(kept).not.toContain('AAPLBUSD')
  expect(kept).not.toContain('AAPLXUSD')
})

test('decimalsFromTick', () => {
  expect(decimalsFromTick('0.5')).toBe(1)
  expect(decimalsFromTick('0.0001')).toBe(4)
  expect(decimalsFromTick('1')).toBe(0)
})

test('backoff floor, doubling and cap', () => {
  expect(backoffMs(0, () => 0)).toBe(1000)
  expect(backoffMs(1, () => 1)).toBe(2400)
  expect(backoffMs(20, () => 1)).toBe(30000)
})

test('subscribe and unsubscribe messages', () => {
  const channels = [{ name: 'ticker', symbols: ['BTCUSD'] }]
  expect(JSON.parse(subscribeMsg(channels))).toEqual({ type: 'subscribe', payload: { channels } })
  expect(JSON.parse(unsubscribeMsg(channels))).toEqual({ type: 'unsubscribe', payload: { channels } })
})
