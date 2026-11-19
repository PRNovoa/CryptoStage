// Order-book fold for Delta's ob_updates: a snapshot, then updates that must arrive with seq = previous + 1.
// This is the lesson's applyFrame rule: a gap is refused and the last good book stays on screen.
// ponytail: checksum (cs) not verified; seq gaps already force resync. Verify cs if desync is seen without a gap.

export const EMPTY_BOOK_STATE = { book: null, pending: false }

const toMap = (levels) => new Map(levels.map(([price, size]) => [price, Number(size)]))

function merge(side, levels) {
  const next = new Map(side)
  for (const [price, size] of levels) {
    if (Number(size) === 0) next.delete(price)
    else next.set(price, Number(size))
  }
  return next
}

export function applyBook(state, msg, focus) {
  const sym = msg.sy ?? msg.symbol // Delta's error frame says `symbol`, not `sy`
  if (sym !== focus) return { state, resync: 'none' }
  if (msg.action === 'snapshot') {
    return { state: { book: { symbol: sym, seq: msg.seq, asks: toMap(msg.a), bids: toMap(msg.b) }, pending: false }, resync: 'none' }
  }
  // Errors come before the pending guard, so a failed reload always schedules another try.
  if (msg.action === 'error') return { state: { ...state, pending: true }, resync: 'delayed' }
  if (state.pending) return { state, resync: 'none' }
  const { book } = state
  if (msg.action === 'update' && book?.symbol === sym && msg.seq === book.seq + 1) {
    return { state: { book: { ...book, seq: msg.seq, asks: merge(book.asks, msg.a), bids: merge(book.bids, msg.b) }, pending: false }, resync: 'none' }
  }
  return { state: { ...state, pending: true }, resync: 'now' }
}

export function topLevels(book, n = 10) {
  const sorted = (side, dir) => [...side].sort((x, y) => dir * (Number(x[0]) - Number(y[0]))).slice(0, n)
  const bids = sorted(book.bids, -1)
  const asks = sorted(book.asks, 1)
  const maxSize = Math.max(0, ...bids.map(([, s]) => s), ...asks.map(([, s]) => s))
  return { bids, asks, maxSize }
}

// Cumulative depth for the nearest n levels per side, ordered outward from the spread.
export function cumulativeDepth(book, n = 10) {
  const side = (levels, dir) => {
    let cum = 0
    return [...levels]
      .map(([price, size]) => ({ price: Number(price), size }))
      .filter((l) => l.size > 0)
      .sort((a, b) => dir * (a.price - b.price))
      .slice(0, n)
      .map((l) => ({ ...l, cum: (cum += l.size) }))
  }
  const bids = side(book.bids, -1)
  const asks = side(book.asks, 1)
  const bestBid = bids[0]?.price ?? null
  const bestAsk = asks[0]?.price ?? null
  const prices = [...bids, ...asks].map((l) => l.price)
  return {
    bids,
    asks,
    bestBid,
    bestAsk,
    spread: bestBid != null && bestAsk != null ? bestAsk - bestBid : null,
    low: prices.length ? Math.min(...prices) : null,
    high: prices.length ? Math.max(...prices) : null,
    maxCum: Math.max(0, bids.at(-1)?.cum ?? 0, asks.at(-1)?.cum ?? 0),
  }
}
