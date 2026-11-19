# CryptoStage

CryptoStage is a React page that shows live crypto prices from the public WebSocket feed of Delta Exchange. You keep a watchlist of up to 20 coins. Clicking a coin opens its detail panel: the price, a session chart and cumulative market depth rebuilt from an order-book snapshot plus numbered updates. It is an extra-credit exercise for FE II, Unit 10 (WebSocket lifecycle, delta streams and safe status display).

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

To present without the exchange, open `http://localhost:5173/?demo=1`.

## Tests

```bash
npm test             # Vitest: protocol, order book, hook, demo replay and components
npx playwright install chromium   # once
npm run e2e          # Playwright: drop and reconnect, demo mode, phone layout
npm run lint
npm run build
```

## Data source

- Socket: `wss://public-socket.india.delta.exchange`, channels `ticker` and `ob_updates`.
- Coin list: `GET https://api.india.delta.exchange/v2/products?contract_types=perpetual_futures&states=live`.
- Prices are USD perpetual futures (`BTCUSD`, `ETHUSD` and so on). The large number is the last traded price; the mark price is shown beside it.
- Delta also lists tokenized stocks as perpetuals (`AAPLBUSD`, `AAPLXUSD`). The picker drops any product whose description mentions "stock". It does not filter on the `BUSD` suffix, because BNBUSD, ARBUSD and 1000SHIBUSD end in it too.
- Delta allows 150 connections per 5 minutes per IP address.

The live `ticker` frame is a compact shape that differs from the documented one. `d[0].ohlc` holds `[open24h, high, low, last]`, and `ts` is in microseconds.

## Connection states

The app keeps these connection states internally. A healthy connection has no visible Live indicator; connecting, stale and reconnecting messages appear beside the watchlist.

| State | Meaning |
|---|---|
| Connecting | A connection attempt is opening. If it hangs on a dead network, the 35 s watchdog gives up on it and retries. |
| Live | The socket is open and at least one watched coin ticked in the last 15 s. With an empty watchlist, heartbeats keep it live. |
| Stale | The socket is open, but no watched coin has ticked for 15 s. |
| Reconnecting | The socket closed. A message counts down to the next attempt. |

Prices and the order book are never cleared during an outage. Each row keeps its last price, and a coin that has been silent for more than 15 s shows "Last update Ns ago", even while the other coins keep streaming.

## Reconnect strategy

- Exponential backoff: 1 s, 2 s, 4 s and so on, up to 30 s, with ±20% jitter. The lesson's fixed 2 s retry could exceed Delta's connection limit during a long outage.
- The delay resets only after a connection has stayed open for 10 s. A server that accepts and then drops the connection keeps the delay growing.
- After every reconnect the page sends `enable_heartbeat` and subscribes the whole watchlist and the focused order book again.
- Heartbeat watchdog: Delta sends a heartbeat every 30 s. If no frame of any kind arrives for 35 s, the page closes the socket and reconnects. This catches a laptop waking from sleep.
- Adding or removing a coin sends `subscribe` or `unsubscribe` on the open socket. It never reconnects.
- The socket closes when the page unmounts.

## The order book as a delta stream

`ob_updates` follows the snapshot and delta pattern from the lesson. `src/delta/book.js` plays the role of the lesson's `applyFrame`:

- A `snapshot` replaces the book.
- An `update` is applied only when its `seq` is the previous one plus 1. A size of `"0"` deletes that price level.
- Any other `seq` is a gap. The book keeps its last good levels, shows "Order book out of sync, reloading…" and asks for a fresh snapshot once. Updates that arrive while it waits are ignored. In the lesson's example, seq 10 receiving seq 12 triggers exactly one reload.
- An `error` frame (Delta names the coin in `symbol`, not `sy`) retries after 3 s.
- Late frames for a coin that is no longer focused are ignored.

One captured update, trimmed to two levels per side:

```json
{"a":[["63021.5","0"],["63022.0","0"]],"action":"update","b":[["63028.5","4799"],["63028.0","5871"]],"cs":820144657,"seq":9807058,"sy":"BTCUSD","ts":1795109419403558,"type":"ob_updates"}
```

The market-depth chart shows cumulative contracts across the nearest 10 bid and 10 ask levels on their real price coordinates. Best bid, spread and best ask are shown above it. The spread is the best ask minus the best bid. Open Price levels to read the nearest five levels per side, with prices in USD and sizes in contracts. Use the pointer or arrow keys to inspect cumulative depth. The checksum `cs` is not verified, because a sequence gap already forces a reload.

## Demo mode

`?demo=1` starts an MSW browser mock before the page renders, the same approach as the lesson's Ex6. The mock replays frames recorded from Delta on 2026-11-19 for BTCUSD and ETHUSD through the normal connection code. It makes no exchange requests.

- "Demo data" stays beside the demo controls for the whole session.
- "Simulate gap" skips one order-book sequence number. The page detects the gap and reloads the book.
- "Simulate drop" closes the socket. It works in live mode too.
- Demo mode never reads or writes the saved live watchlist. Coins added or removed in the demo are kept in memory only.
- If the mock cannot start, the page offers "Retry" and "Use live data" and opens no socket.

## Look and motion

- An open two-column layout, with an ink-and-champagne dark theme and an ivory light theme. Teal and brick show market direction, accompanied by icons and signs.
- Georgia for asset names and IBM Plex Sans for data and controls. Prices use tabular digits.
- Theme controls offer System, Light and Dark, with System as the default. Theme and motion preferences persist separately from the watchlist, and blocked storage does not prevent the page from loading.
- Quotes update immediately. The chart reveals its newest segment over 300 ms while keeping its scale and inspected values exact. Market-depth shapes transition as the book changes. Asset selection animates the identity and chart together.
- Ambient contour lines move in the outer margins. Motion off and reduced-motion preferences stop geometric animation; ambient motion also pauses when the page is hidden.
- Theme, motion and demo controls are below the market workspace. There is no application top bar or healthy-state Live badge.

## Compact layout

Below 1024 px the page shows one view at a time. The watchlist fills the screen; selecting a coin opens its detail view. The Watchlist action or the browser's Back button returns to the selected row. Keyboard focus moves to the coin's name on entry and back to its row on return.

## Project map

| Path | Role |
|---|---|
| `src/delta/protocol.js` | URLs, message builders, ticker parsing, stock filter, backoff |
| `src/delta/book.js` | Order-book fold, top levels and cumulative depth |
| `src/delta/useDelta.js` | The one socket: subscriptions, reconnect, watchdog, freshness |
| `src/watchlist.js` | Saved watchlist and add validation |
| `src/demo/handlers.js` | MSW replay for demo mode |
| `src/motion.js` | Chart-segment animation and reduced-motion handling |
| `src/prefs.js` | Theme and motion preference storage |
| `src/components/` | Watchlist, picker, connection feedback, asset detail, chart, depth and preferences |
| `e2e/` | Playwright tests |

## Project documentation

`DESIGN.md` records the current visual system. `docs/superpowers/plans/` contains planning history; its proposals and checklists are not a release-status report. `docs/ai-declaration-log.md` records accepted and rejected AI assistance and verification results.
