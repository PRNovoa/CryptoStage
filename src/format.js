const formatters = new Map()

export function formatPrice(value, decimals) {
  if (!formatters.has(decimals)) {
    formatters.set(decimals, new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }))
  }
  return formatters.get(decimals).format(value)
}

export const formatChange = (pct) => `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(2)}%`
export const direction = (pct) => (pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat')
export const baseSymbol = (symbol) => symbol.replace(/USD$/, '')
export const ageSeconds = (nowMs, at) => Math.floor((nowMs - at) / 1000)
