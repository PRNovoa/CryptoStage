export const SOCKET_URL = 'wss://public-socket.india.delta.exchange'
export const REST_URL = 'https://api.india.delta.exchange'

export const subscribeMsg = (channels) => JSON.stringify({ type: 'subscribe', payload: { channels } })
export const unsubscribeMsg = (channels) => JSON.stringify({ type: 'unsubscribe', payload: { channels } })

// The live `ticker` frame is a compact shape the docs don't describe: d[0].ohlc = [open24h, high, low, last].
export function parseTicker(msg) {
  const d = msg?.type === 'ticker' ? msg.d?.[0] : null
  if (!d?.ohlc) return null
  const [open24h, , , last] = d.ohlc
  return {
    symbol: msg.sy,
    last,
    mark: Number(d.m),
    open24h,
    change24hPct: ((last - open24h) / open24h) * 100,
    ts: Math.floor(msg.ts / 1000),
  }
}

// ponytail: description match; recheck if Delta adds a new tokenized-asset family.
export const isCryptoPerp = (p) => p.contract_type === 'perpetual_futures' && !/stock/i.test(p.description)

export const decimalsFromTick = (tick) => (String(tick).split('.')[1] ?? '').length

export const backoffMs = (attempt, rand = Math.random) =>
  Math.round(Math.min(30000, Math.max(1000, 1000 * 2 ** attempt * (0.8 + 0.4 * rand()))))
