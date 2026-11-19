import { expect, test } from 'vitest'
import { OB_ERROR, OB_SNAPSHOT, OB_UPDATE_GAP, OB_UPDATE_NEXT } from './fixtures.js'
import { applyBook, EMPTY_BOOK_STATE, topLevels } from './book.js'

const snap = (seq, a = [['101', '5'], ['102', '3']], b = [['100', '4'], ['99', '2']]) =>
  ({ action: 'snapshot', sy: 'BTCUSD', seq, a, b })
const upd = (seq, a = [], b = []) => ({ action: 'update', sy: 'BTCUSD', seq, a, b })
const fold = (state, msg, focus = 'BTCUSD') => applyBook(state, msg, focus)

test('snapshot then next update applies', () => {
  const s1 = fold(EMPTY_BOOK_STATE, OB_SNAPSHOT)
  expect(s1.resync).toBe('none')
  const zeroed = OB_UPDATE_NEXT.a.find(([, size]) => size === '0')
  const s2 = fold(s1.state, OB_UPDATE_NEXT)
  expect(s2.resync).toBe('none')
  expect(s2.state.book.seq).toBe(OB_SNAPSHOT.seq + 1)
  if (zeroed) expect(s2.state.book.asks.has(zeroed[0])).toBe(false)
  const r = fold(fold(EMPTY_BOOK_STATE, snap(1)).state, upd(2, [['101', '0'], ['103', '7']]))
  expect([...r.state.book.asks]).toEqual([['102', 3], ['103', 7]])
})

test('gap keeps last good book and asks resync', () => {
  const s1 = fold(EMPTY_BOOK_STATE, snap(10)).state
  const r = fold(s1, upd(12, [['101', '9']]))
  expect(r.resync).toBe('now')
  expect(r.state.pending).toBe(true)
  expect(r.state.book).toBe(s1.book)
  expect(r.state.book.asks.get('101')).toBe(5)
  expect(fold(fold(EMPTY_BOOK_STATE, OB_SNAPSHOT).state, OB_UPDATE_GAP).resync).toBe('now')
})

test('updates after a gap are ignored until the snapshot', () => {
  let { state } = fold(fold(EMPTY_BOOK_STATE, snap(10)).state, upd(12))
  for (const seq of [13, 14, 15]) {
    const r = fold(state, upd(seq, [['101', '1']]))
    expect(r.resync).toBe('none')
    expect(r.state).toBe(state)
    state = r.state
  }
  expect(fold(state, snap(20)).state.pending).toBe(false)
})

test('several updates before the first snapshot ask exactly one resync', () => {
  const r1 = fold(EMPTY_BOOK_STATE, upd(5))
  expect(r1.resync).toBe('now')
  expect(fold(r1.state, upd(6)).resync).toBe('none')
  expect(fold(fold(r1.state, upd(6)).state, upd(7)).resync).toBe('none')
})

test('documented error frame recovers', () => {
  const s1 = fold(EMPTY_BOOK_STATE, snap(10)).state
  const r = fold(s1, OB_ERROR)
  expect(r.resync).toBe('delayed')
  expect(r.state.book).toBe(s1.book)
  expect(r.state.pending).toBe(true)
})

test('snapshot → gap → error → error → snapshot', () => {
  let { state } = fold(EMPTY_BOOK_STATE, snap(10))
  const steps = [upd(12), OB_ERROR, OB_ERROR].map((m) => {
    const r = fold(state, m)
    state = r.state
    return r.resync
  })
  expect(steps).toEqual(['now', 'delayed', 'delayed'])
  expect(fold(state, snap(30)).state.pending).toBe(false)
})

test('late frames from the old focus are ignored', () => {
  const s1 = fold(EMPTY_BOOK_STATE, snap(10)).state
  const r = fold(s1, upd(11, [['101', '9']]), 'ETHUSD')
  expect(r.resync).toBe('none')
  expect(r.state).toBe(s1)
})

test('topLevels sorts and caps', () => {
  const a = Array.from({ length: 15 }, (_, i) => [String(200 - i), String(i + 1)])
  const b = Array.from({ length: 15 }, (_, i) => [String(100 + i), String(i + 1)])
  const { book } = fold(EMPTY_BOOK_STATE, snap(1, a, b)).state
  const top = topLevels(book, 10)
  expect(top.asks.map(([p]) => p)).toEqual(['186', '187', '188', '189', '190', '191', '192', '193', '194', '195'])
  expect(top.bids.map(([p]) => p)).toEqual(['114', '113', '112', '111', '110', '109', '108', '107', '106', '105'])
  expect(top.maxSize).toBe(15)
})

import { cumulativeDepth } from './book.js'

const bookOf = (bids, asks) => ({ symbol: 'X', seq: 1, bids: new Map(bids), asks: new Map(asks) })

test('cumulativeDepth sorts each side outward from the spread and accumulates sizes', () => {
  const d = cumulativeDepth(bookOf([['99', 2], ['100', 4], ['98', 1]], [['102', 3], ['101', 1]]))
  expect(d.bids).toEqual([{ price: 100, size: 4, cum: 4 }, { price: 99, size: 2, cum: 6 }, { price: 98, size: 1, cum: 7 }])
  expect(d.asks).toEqual([{ price: 101, size: 1, cum: 1 }, { price: 102, size: 3, cum: 4 }])
  expect(d.maxCum).toBe(7)
  expect(d).toMatchObject({ bestBid: 100, bestAsk: 101, spread: 1, low: 98, high: 102 })
})

test('cumulativeDepth keeps only the nearest n levels and skips zero sizes', () => {
  const bids = Array.from({ length: 15 }, (_, i) => [String(100 - i), i === 1 ? 0 : 1])
  const d = cumulativeDepth(bookOf(bids, []), 10)
  expect(d.bids).toHaveLength(10)
  expect(d.bids.map((l) => l.price)).not.toContain(99)
  expect(d.bids.at(-1)).toMatchObject({ price: 90, cum: 10 })
})

test('cumulativeDepth reports a missing side without inventing a spread', () => {
  const d = cumulativeDepth(bookOf([['100', 4]], []))
  expect(d.asks).toEqual([])
  expect(d).toMatchObject({ bestBid: 100, bestAsk: null, spread: null, low: 100, high: 100 })
  expect(cumulativeDepth(bookOf([], []))).toMatchObject({ bids: [], asks: [], maxCum: 0, spread: null })
})
