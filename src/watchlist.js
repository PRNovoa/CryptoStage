export const DEFAULT_WATCHLIST = ['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD', 'BNBUSD', 'DOGEUSD', 'ADAUSD', 'AVAXUSD']
export const MAX_WATCHLIST = 20
const KEY = 'cryptostage.watchlist'

export function loadWatchlist(storage) {
  try {
    const list = JSON.parse((storage ?? window.localStorage).getItem(KEY))
    if (!Array.isArray(list) || !list.every((s) => typeof s === 'string')) return DEFAULT_WATCHLIST
    return [...new Set(list)].slice(0, MAX_WATCHLIST)
  } catch {
    return DEFAULT_WATCHLIST
  }
}

export function saveWatchlist(list, storage) {
  try {
    ;(storage ?? window.localStorage).setItem(KEY, JSON.stringify(list))
  } catch {
    // Private mode or blocked storage: the list just won't survive a reload.
  }
}

export function addError(symbol, watchlist, products) {
  if (!products) return "Coin list didn't load."
  if (!products.some((p) => p.symbol === symbol)) return 'Pick a coin from the list.'
  if (watchlist.includes(symbol)) return 'Already in your watchlist.'
  if (watchlist.length >= MAX_WATCHLIST) return `Watchlist is full (${MAX_WATCHLIST}).`
  return null
}
