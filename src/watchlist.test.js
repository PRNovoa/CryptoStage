import { expect, test, vi } from 'vitest'
import { PRODUCTS_SAMPLE } from './delta/fixtures.js'
import { isCryptoPerp } from './delta/protocol.js'
import { addError, DEFAULT_WATCHLIST, loadWatchlist, MAX_WATCHLIST, saveWatchlist } from './watchlist.js'

const fakeStorage = (raw) => {
  let value = raw
  return { getItem: () => value, setItem: (_k, v) => { value = v } }
}

test('loadWatchlist survives junk', () => {
  for (const raw of [null, '{', '"x"', '[1,2]']) expect(loadWatchlist(fakeStorage(raw))).toEqual(DEFAULT_WATCHLIST)
  expect(loadWatchlist({ getItem() { throw new Error('denied') } })).toEqual(DEFAULT_WATCHLIST)
})

test('throwing localStorage getter falls back and save does not throw', () => {
  const spy = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('SecurityError') })
  expect(loadWatchlist()).toEqual(DEFAULT_WATCHLIST)
  expect(() => saveWatchlist(['BTCUSD'])).not.toThrow()
  spy.mockRestore()
})

test('empty watchlist persists', () => {
  const s = fakeStorage(null)
  saveWatchlist([], s)
  expect(loadWatchlist(s)).toEqual([])
})

test('loadWatchlist dedupes and caps', () => {
  const many = Array.from({ length: 25 }, (_, i) => 'C' + i)
  expect(loadWatchlist(fakeStorage(JSON.stringify(['A', 'A', 'B'])))).toEqual(['A', 'B'])
  expect(loadWatchlist(fakeStorage(JSON.stringify(many)))).toHaveLength(MAX_WATCHLIST)
})

test('addError refuses unknown, stock, duplicate and full', () => {
  const crypto = PRODUCTS_SAMPLE.filter(isCryptoPerp)
  expect(addError('NOPE', [], crypto)).toBe('Pick a coin from the list.')
  expect(addError('AAPLBUSD', [], crypto)).toBe('Pick a coin from the list.')
  expect(addError('BTCUSD', ['BTCUSD'], crypto)).toBe('Already in your watchlist.')
  expect(addError('BNBUSD', Array.from({ length: 20 }, (_, i) => 'X' + i), crypto)).toBe('Watchlist is full (20).')
  expect(addError('BNBUSD', [], null)).toBe("Coin list didn't load.")
  expect(addError('BNBUSD', [], crypto)).toBeNull()
})
