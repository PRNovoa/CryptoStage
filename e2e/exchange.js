// A Playwright stand-in for Delta: answers the products request and the socket with fixture frames.
import { OB_SNAPSHOT, PRODUCTS_SAMPLE, TICKER_BTC } from '../src/delta/fixtures.js'
import { REST_URL, SOCKET_URL } from '../src/delta/protocol.js'

export const tickerFor = (sy, last) => ({ ...TICKER_BTC, sy, ts: Date.now() * 1000, d: [{ ...TICKER_BTC.d[0], s: sy, ohlc: [last, last, last, last] }] })

export async function mockExchange(context, { products = PRODUCTS_SAMPLE } = {}) {
  const sockets = []
  await context.route(REST_URL + '/v2/products**', (route) => route.fulfill({ json: { success: true, result: products } }))
  await context.routeWebSocket(SOCKET_URL, (ws) => {
    const s = { ws, received: [] }
    sockets.push(s)
    ws.onMessage((raw) => {
      const msg = JSON.parse(raw)
      s.received.push(msg)
      if (msg.type !== 'subscribe') return
      for (const ch of msg.payload.channels) {
        if (ch.name === 'ticker') ch.symbols.forEach((sy, i) => ws.send(JSON.stringify(tickerFor(sy, 100 + i))))
        if (ch.name === 'ob_updates') ws.send(JSON.stringify({ ...OB_SNAPSHOT, sy: ch.symbols[0] }))
      }
    })
  })
  return sockets
}
