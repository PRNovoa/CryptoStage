# CryptoStage Implementation Plan

> **Design superseded (2026-11-19):** the palette, type, layout, selection, motion and order-book sections below describe the first build. `DESIGN.md` at the repo root is the current design direction and wins where they conflict. Data, connection, recovery, demo and test requirements here still apply.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local React page that streams live crypto perpetual prices from Delta Exchange's public WebSocket, with an editable watchlist and a focus view whose order book is a real snapshot + delta stream (FE II Unit 10, extra credit).

**Architecture:** The browser talks straight to `wss://public-socket.india.delta.exchange`. There is no server of our own. One hook owns one socket: it subscribes `ticker` for the watchlist and `ob_updates` for the focused coin, reconnects with backoff, and keeps the last good data on screen. The protocol parsing and the order-book fold are pure functions, so they're unit-tested against frames captured from the real feed. An opt-in demo mode (`?demo=1`) starts an MSW browser mock before React renders. It replays recorded frames through the same hook and makes no Delta network requests.

**Tech Stack:** Vite + React (plain JS, as in the lesson), Vitest + MSW `ws.link`, Playwright `routeWebSocket`, `@fontsource` fonts. Pin the resolved versions of the scaffold and added packages, including MSW, and commit the lockfile. The browser mock, node tests and generated worker use that same installed MSW version.

**Spec:** the grilling decisions in the conversation of 2026-11-19, summarized in *Settled decisions* below. Lesson: https://ruvebal.github.io/web-atelier-udit/lessons/en/feii/unit-10-iot-python-backend/

## Settled decisions (the spec)

- Data source: Delta Exchange India public socket. It's browser-direct, with no relay server.
- Instruments: USD perpetual futures (`BTCUSD`…), labelled "perp". The main price is the last traded price, with the mark price in small type.
- Watchlist: defaults are `BTCUSD ETHUSD SOLUSD XRPUSD BNBUSD DOGEUSD ADAUSD AVAXUSD`, with a max of 20. Users add coins by searching `/v2/products` (crypto only, with no tokenized stocks; see Verified facts). The list persists in `localStorage`. Adding or removing a coin sends subscribe/unsubscribe on the live socket.
- Each row shows the price, the 24h change, a flash when the price changes, and a sparkline of the last 48 ticks. If that coin has received no ticker for more than 15 s, keep its last price and show "Last update 25s ago" with the actual elapsed seconds, even if other coins keep the global pill live.
- Connection pill: live / reconnecting / stale, plus how many seconds since the last message. The last good data is never blanked.
- The focus view opens on click: a big price, a session chart with a crosshair, and the top 10 order-book levels per side from `ob_updates`. An update is applied only when `seq === prev + 1`. On a gap or an `error` action, it re-subscribes and keeps the last good book visible.
- Reconnect: backoff of 1s, 2s, 4s… up to a 30s cap, with ±20% jitter. After reconnecting it re-subscribes everything. It uses Delta's heartbeat with a 35s watchdog and closes the socket on unmount.
- A "Simulate drop" button closes the socket, for the in-class demo. A "Use demo data" link opens `?demo=1`; "Use live data" returns to the same path without that parameter. Demo mode always displays "Demo data" beside the connection pill and replays normal trading from BTCUSD and ETHUSD recordings. The presenter triggers disruptions: a "Simulate gap" button (demo only) skips one book sequence number, and the existing "Simulate drop" closes the socket. Recorded ticks, heartbeats and recovery still use their specified timers. It works without the exchange and never reads or writes the live watchlist in localStorage.
- Paperwork: a README (run steps, reconnect strategy, the states) and `docs/ai-declaration-log.md` (ACCEPT/REJECT rows).
- The selected watch row has a persistent cyan edge, a slightly lighter background and `aria-pressed="true"`; keyboard focus has its own outline. On mobile (<720px), explicitly selecting a coin brings the focus stage into view without moving keyboard focus, and reduced motion disables smooth scrolling. The ladder labels prices in USD and sizes in contracts, with the best-ask minus best-bid spread at its centre.
- English UI. It runs locally only (`npm run dev`).
- Out of scope: candlestick history, login, trading, alerts, i18n, deployment.

## Global constraints

- REST base `https://api.india.delta.exchange`, socket `wss://public-socket.india.delta.exchange`. `api.delta.exchange` is Delta Global and must not be used.
- Use the channel names `ticker` and `ob_updates`. The old `v2/ticker` and `l2_updates` were removed on 31 Jul 2026.
- Delta limits connections to 150 per 5 minutes per IP. Never reconnect in a tight loop, and the backoff floor is 1000 ms.
- Demo mode uses the existing fixtures and the already-installed `msw`, with no new dependency, no socket factory in the hook, and no second implementation of reconnect/book recovery. It is opt-in; failures in live mode never silently switch to recorded data.
- Ponytail rules apply: no abstraction, option or dependency that the plan doesn't name. Every shortcut with a known limit gets a `// ponytail:` comment.
- The user approves every commit message before `git commit` (memory rule). Each task ends by proposing its message.
- Accessibility floor: visible focus, `prefers-reduced-motion` honored, up/down never shown by color alone (always an up/down icon, a sign, and visually hidden "up"/"down" text), and the live price region uses `aria-live="polite"` on the focus price only. It must not be on every row, or a screen reader would chatter.

## Verified facts (probed 2026-11-19, keep the fixtures)

The `ticker` frame is compact and **not the documented v2 shape**:
```json
{"type":"ticker","sy":"BTCUSD","ts":1795107256190831,"sp":"62797.6",
 "d":[{"s":"BTCUSD","m":"62772.95","m24hc":"0.5798","ohlc":[62506,64056,62037,62779.5],"q":["62779.5","4784","62779","5309",null], ...}]}
```
`ohlc[3]` is the last price, `ohlc[0]` is the 24h open, `m` is the mark price and `m24hc` is the mark's 24h change in %. It ticks about every 5 s per symbol, so 48 ticks is about 4 min.

The `ob_updates` frame looks like `{"action":"snapshot"|"update"|"error","a":[[price,size]...],"b":[...],"seq":9798535,"sy":"BTCUSD","cs":...}`. A size of `"0"` deletes that level. The heartbeat frame is `{"type":"heartbeat"}`, sent after `{"type":"enable_heartbeat"}`. `/v2/products?contract_types=perpetual_futures&states=live` returns 261 products. Stocks come in two families, bStocks (`AAPLBUSD`) and xStocks (`AAPLXUSD`). **Don't filter by the `BUSD` suffix:** it also matches BNBUSD, ARBUSD, 1000SHIBUSD, TRBUSD, LABUSD and BBUSD, which are all crypto. On 2026-11-19, `/stock/i` on `description` matched all 57 stocks and no crypto. Delta's heartbeat interval is documented as 30 s. The products' `tick_size` sets the price decimals.

## Design direction (frontend-design + impeccable: Operate mode)

**Subject:** a live market floor seen at night. **Audience:** you and a professor during a demo. **Job:** read prices at a glance and *see* the stream working.

| Token | Value | Role |
|---|---|---|
| `--bg` | `#0F1526` | deep night indigo, not tinted black |
| `--panel` | `#161E33` | the focus stage |
| `--line` | `#26304A` | row dividers, axes |
| `--ink` / `--ink-2` | `#E6EAF2` / `#9AA6BF` | text / secondary text |
| `--up` / `--up-text` | `#1C96C8` / `#5CC8F0` | rising: marks / text |
| `--down` / `--down-text` | `#C97A16` / `#F0A84A` | falling: marks / text |

The up/down mark pair passed `dataviz/scripts/validate_palette.js --mode dark --surface #0F1526`: all checks pass, with a worst CVD ΔE of 21.9. Cyan vs amber is the Night City pairing, and unlike red/green it survives deuteranopia. Text variants are lighter, so contrast only goes up. Re-run the validator if any hex changes.

**Type:** Chakra Petch 600 for prices and the wordmark (angular, technical), IBM Plex Sans 400/500 for everything else, both via `@fontsource`. Every number uses `font-variant-numeric: tabular-nums`. Task 1 checks that Chakra Petch has `tnum` (`fc-query`/fonttools). If it doesn't, prices fall back to Plex Sans 600 so the digits don't jitter.

**Layout:** dense rows keep symbols, prices and changes aligned for comparison:
```
┌ CryptoStage ────────────────────────────── ● Live  2s ago  [Simulate drop] ┐
│ Watchlist  [Add coin…]        │  BTCUSD perp                              │
│ BTC  ╱╲╱‾╲  62,779.5  ▲0.44%  │  62,779.5        mark 62,772.95  ▲0.44%   │
│ ETH  ╲_╱╲_  1,768.65  ▲1.69%  │  ┌ session chart, crosshair ──────────┐   │
│ SOL  ...                  ✕   │  └────────────────────────────────────┘   │
│ ...                           │  bids ████████ 62,779 | 62,780 ███ asks   │
│                               │       ██████   62,778 | 62,781 █████      │
└───────────────────────────────┴───────────────────────────────────────────┘
```
Left-aligned, numbers right-aligned in their column. Mobile (<720px): one column, and the focus stage stacks under the list. On an explicit coin selection, scroll the newly selected stage into view after its content commits; use smooth scrolling normally and immediate scrolling under `prefers-reduced-motion: reduce`. Preserve focus on the selecting button, add `scroll-margin-top: 16px` to the stage, and do not scroll on initial load, ticker updates, or automatic focus changes after removal.

**Selection:** use the agreed persistent 3px cyan inset edge (`--up`), `--panel` background and `--ink` 600 symbol text on the selected row at both layouts. The edge identifies the selected coin. The select button has `aria-pressed`; `:focus-visible` uses a separate 2px `--ink` outline with a 2px offset. Selection remains visible when keyboard focus moves to another row or the remove button. Keep this state indicator when applying the design checks below.

**Order-book emphasis:** the mirrored ladder. Bids grow left in cyan and asks grow right in amber, around the spread. Depth bars scale to the largest size of the 20 visible levels. Each side has quiet "Price (USD)" and "Size (contracts)" labels. The centre shows "Spread 0.50 USD", formatted with the product decimals and calculated from the best ask minus the best bid; if either side is missing, show "Spread unavailable". While a book is being recovered, keep the spread with the retained levels and the existing recovery message. Everything else stays quiet.

**Motion (emil-design-eng):** rows tick every 5 s each, so a row flash is text color only (`--up-text`/`--down-text` fading back to `--ink`, 600 ms `ease`, no background, no movement). Only the focus price uses a fading background tint, so one price gets the strongest update cue. Book bars use a `transform: scaleX` transition of 150 ms `cubic-bezier(0.23,1,0.32,1)`. Buttons get `scale(0.97)` on `:active`. Under reduced motion, price colors may still change; apply book-size and button-state changes immediately.

**Copy:** sentence case, no ALL-CAPS eyebrows, no `·`-joined meta strings anywhere, including the pill, and no em dashes in UI copy, the README or the AI log. The empty watchlist says "Your watchlist is empty. Add a coin to start streaming." An error says what happened and what the app does next, e.g. "Order book out of sync, reloading…".

## Design and writing checks

These checks apply to the UI, README and AI log. Keep the specified night-market palette, fonts, data density, selection cue and mirrored ladder. Judge refinements against the job: comparing prices and showing a working stream during the class demo.

- Keep the watchlist's price and change columns aligned across long symbols, missing data and age warnings. Use one focus stage. Charts, depth bars and their grids represent received data; the session chart starts with the first received point, and loading states never fabricate a price history.
- Keep the order book visually prominent. Use the defined surfaces and row dividers for structure. Omit marketing heroes, extra metric cards, nested cards, gradient text, neon glows, glass panels, background grid overlays and decorative counters. Grid lines inside the chart can mark actual prices and times.
- Use Chakra Petch for the specified prices and wordmark, and Plex Sans for controls and explanations. Use the shared SVG icons. Keep text labels readable and number widths stable. Selection, keyboard focus and a price flash must stay distinguishable when visible together.
- Motion gives feedback for a price update, book-size change or explicit action. Use quieter row text flashes and the single focus-price tint. The page opens ready for use; reconnecting does not trigger an entrance sequence or celebration.
- Write controls as actions and states as facts. Keep "Use demo data", "Simulate gap", "Simulate drop", "Last update Ns ago" and the specified recovery messages consistent across UI and docs. Errors name the failed operation and the next action. Keep the ticking age outside live regions, and keep "Demo data" visible beside a Live status.
- Use direct sentences in the README and AI log. Remove promotional claims, generic introductions, rhetorical reversals, inflated conclusions and repeated restatements. Preserve API names, quoted source material, command flags, units, exact copy and recorded values. Keep the AI log factual: record actual accepted or rejected assistance and checks performed; leave checks marked pending until run. Use sentence case for headings and the existing structured tables and test steps where they help scanning.

## Review focus

1. **Removing the focused coin.** Focus moves to the first remaining coin and the old symbol's `ob_updates` is unsubscribed. Test in Task 4.
2. **Removing every coin.** The empty state shows, the app sends no empty `subscribe`, the socket stays open, the pill stays `Live` on heartbeats alone, and the empty list survives a reload. Tests in Task 2 and Task 4.
3. **Corrupt or throwing `localStorage`** (private mode, bad JSON, a non-array). The defaults load and the page doesn't crash. Test in Task 2.
4. **A saved symbol that's no longer live.** The row shows "waiting for data" rather than 0 or NaN, and it can still be removed. Test in Task 6.
5. **Laptop sleep or a long-hidden tab.** The 35s heartbeat watchdog fires, so the pill shows reconnecting, then live after re-subscribing, and the old prices stay on screen meanwhile. Test in Task 4 (fake timers).
6. **One coin stops while another keeps streaming.** Only the silent coin gets an age warning; its last price stays visible. Tests in Tasks 4 and 6.
7. **Classroom network is unavailable.** Demo mode recovers from a simulated gap and drop with external requests blocked, labels the data, and preserves the saved live watchlist. Tests in Tasks 5 and 7.
8. **Mobile selection with reduced motion.** A selected coin reveals its stage without animated scrolling or lost keyboard focus. Task 6 checks the scroll options; Task 7 checks the heading actually enters the viewport.
9. **A snapshot arrives before a delayed reload fires.** Cancel the pending timer, clear the recovery message, and send no redundant resubscription. Test in Task 4.
10. **Demo startup fails or live mode opens after demo mode.** A failed mock startup shows a retry/live-mode choice before any app socket opens. A fresh live navigation loads the live feed without importing the demo handlers or starting MSW. Tests in Task 7.

---

### Task 1: Scaffold, tokens, fixtures

**Files:**
- Create: the Vite React JS scaffold in the repo root, `src/styles.css`, `src/delta/fixtures.js`, `.gitignore`
- Create: `src/test-setup.js`
- Modify: `package.json` (scripts `test` = `vitest run`, `e2e` = `playwright test`), `vite.config.js`

- [ ] **Step 1:** `npm create vite@latest . -- --template react`, then `npm i @fontsource/chakra-petch @fontsource/ibm-plex-sans` and `npm i -D vitest jsdom @testing-library/react msw @playwright/test`. Delete the template's demo CSS, logos and counter.
- [ ] **Step 2:** Write `src/styles.css` with the token table above on `:root`, `body { background: var(--bg) }`, the font imports, the `tabular-nums` rule, `:focus-visible` outlines, a `prefers-reduced-motion` block, and the browser surfaces themed from the palette (`::selection`, `caret-color`, `accent-color`, `scrollbar-color`). Check Chakra Petch for `tnum` and record the result in a CSS comment.
- [ ] **Step 3:** Capture real frames into `src/delta/fixtures.js`, exporting `TICKER_BTC`, `OB_SNAPSHOT`, `OB_UPDATE_NEXT` (seq = snapshot + 1), `OB_UPDATE_GAP` (seq = snapshot + 2), `OB_ERROR`, `PRODUCTS_SAMPLE` (BTCUSD, BNBUSD, ARBUSD, AAPLBUSD, AAPLXUSD, ETHUSD). Also export `DEMO_RECORDINGS`, keyed by BTCUSD and ETHUSD, each containing `{tickers, snapshot, updates}`: at least three captured ticker frames, a snapshot with 10 levels per side, and two consecutive captured book updates. Use a throwaway node script like the one from planning. Keep the unit-test book fixtures to 5 levels; keep enough depth in demo recordings to fill the visible ladder. Record the capture date, and never mutate the exported fixtures during replay.
- [ ] **Step 4:** In `vite.config.js`, add `test: { environment: 'jsdom', include: ['src/**/*.test.{js,jsx}'], setupFiles: ['src/test-setup.js'] }`. The include list keeps Playwright's `e2e/` out of Vitest. `src/test-setup.js` exports `server = setupServer()` from `msw/node`, with `beforeAll(listen)`, `afterEach(resetHandlers + cleanup)` and `afterAll(close)`.
- [ ] **Step 5:** Run `npm run dev` and expect an indigo page with no console errors. Run `npm test` and expect "no test files".
- [ ] **Step 6:** Propose the commit `chore: scaffold CryptoStage with tokens and captured Delta fixtures`.

### Task 2: Pure protocol, watchlist and backoff

**Files:**
- Create: `src/delta/protocol.js`, `src/delta/protocol.test.js`, `src/watchlist.js`, `src/watchlist.test.js`

**Interfaces (Produces):**
- `SOCKET_URL`, `REST_URL` constants
- `subscribeMsg(channels: {name, symbols}[]) -> string` and `unsubscribeMsg(channels) -> string`. Both return the JSON text with `type` and `payload.channels`.
- `parseTicker(msg) -> {symbol, last:number, mark:number, open24h:number, change24hPct:number, ts:number} | null`. It returns null for non-ticker frames. `ts` is Delta's microseconds converted to ms: `Math.floor(msg.ts / 1000)`. `change24hPct = (last - open24h) / open24h * 100`. Compute it from `ohlc` rather than `m24hc`, so the % matches the price shown.
- `isCryptoPerp(product) -> boolean`: `contract_type === 'perpetual_futures'` and the description doesn't match `/stock/i`. There is deliberately no symbol-suffix rule (see Verified facts). `// ponytail: description match; recheck if Delta adds a new tokenized-asset family.`
- `decimalsFromTick(tick: string) -> number`, so `"0.5"` gives 1 and `"0.0001"` gives 4.
- `backoffMs(attempt: number, rand = Math.random) -> number`: `clamp(1000 * 2**attempt * (0.8 + 0.4*rand()), 1000, 30000)`, so the floor and cap hold after jitter.
- `DEFAULT_WATCHLIST`, `MAX_WATCHLIST = 20`, `loadWatchlist(storage?) -> string[]`, `saveWatchlist(list, storage?) -> void`. Both resolve `storage ?? window.localStorage` **inside** the try/catch, because the `localStorage` getter itself can throw. With no stored value, or one that isn't an array of strings, loading falls back to the defaults. `[]` is valid and stays empty. It dedupes and caps at 20.
- `addError(symbol, watchlist, products) -> string|null`. It returns the reason the Add action is refused, or null: `"Pick a coin from the list."` (not in the filtered products, which covers typos and stocks), `"Already in your watchlist."`, `"Watchlist is full (20)."`, `"Coin list didn't load."` (products null).

- [ ] **Step 1: Write the failing tests**
```js
test('parseTicker reads compact frame', () => {
  expect(parseTicker(TICKER_BTC)).toMatchObject({ symbol: 'BTCUSD', last: TICKER_BTC.d[0].ohlc[3] });
  expect(parseTicker({ type: 'heartbeat' })).toBeNull();
});
test('isCryptoPerp drops both stock families but keeps BNB and ARB', () => {
  const kept = PRODUCTS_SAMPLE.filter(isCryptoPerp).map(p => p.symbol);
  expect(kept).toEqual(expect.arrayContaining(['BTCUSD', 'BNBUSD', 'ARBUSD']));
  expect(kept).not.toContain('AAPLBUSD'); expect(kept).not.toContain('AAPLXUSD');
});
test('parseTicker converts microseconds to ms', () => {
  expect(parseTicker(TICKER_BTC).ts).toBe(Math.floor(TICKER_BTC.ts / 1000));
});
test('backoff floor, doubling and cap', () => {
  expect(backoffMs(0, () => 0)).toBe(1000); expect(backoffMs(1, () => 1)).toBe(2400);
  expect(backoffMs(20, () => 1)).toBe(30000);
});
test('loadWatchlist survives junk', () => {
  for (const raw of [null, '{', '"x"', '[1,2]']) expect(loadWatchlist(fakeStorage(raw))).toEqual(DEFAULT_WATCHLIST);
  expect(loadWatchlist({ getItem() { throw new Error('denied') } })).toEqual(DEFAULT_WATCHLIST);
});
test('throwing localStorage getter falls back and save does not throw', () => {
  const spy = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('SecurityError') });
  expect(loadWatchlist()).toEqual(DEFAULT_WATCHLIST); expect(() => saveWatchlist(['BTCUSD'])).not.toThrow();
  spy.mockRestore();
});
test('empty watchlist persists', () => {
  const s = fakeStorage(null); saveWatchlist([], s); expect(loadWatchlist(s)).toEqual([]);
});
test('addError refuses unknown, stock, duplicate and full', () => {
  const crypto = PRODUCTS_SAMPLE.filter(isCryptoPerp);
  expect(addError('NOPE', [], crypto)).toBe('Pick a coin from the list.');
  expect(addError('AAPLBUSD', [], crypto)).toBe('Pick a coin from the list.');
  expect(addError('BTCUSD', ['BTCUSD'], crypto)).toBe('Already in your watchlist.');
  expect(addError('BNBUSD', Array.from({ length: 20 }, (_, i) => 'X' + i), crypto)).toBe('Watchlist is full (20).');
  expect(addError('BNBUSD', [], crypto)).toBeNull();
});
```
- [ ] **Step 2:** Run `npx vitest run src/delta/protocol.test.js src/watchlist.test.js` and expect FAIL (module not found).
- [ ] **Step 3:** Implement the functions with the signatures above.
- [ ] **Step 4:** Run again and expect PASS.
- [ ] **Step 5:** Propose the commit `feat: Delta protocol parsing, backoff and persisted watchlist`.

### Task 3: Order-book fold (the lesson's delta rule)

**Files:**
- Create: `src/delta/book.js`, `src/delta/book.test.js`

**Interfaces (Produces):**
- `applyBook(state: BookState, msg, focus: string) -> {state: BookState, resync: 'none'|'now'|'delayed'}` where `BookState = {book: Book|null, pending: boolean}` and `Book = {symbol, seq, bids: Map<string,number>, asks: Map<string,number>}`. `EMPTY_BOOK_STATE = {book: null, pending: false}`. `pending` is tracked separately from the nullable book, so deduplication also works before the first snapshot. The rules apply in this order, with `sym = msg.sy ?? msg.symbol` (Delta's error frame uses `symbol`, not `sy`):
  1. `sym !== focus` means a late frame from an old focus. Return the state unchanged, `'none'`.
  2. `snapshot` gives `{book: new, pending: false}`, `'none'`.
  3. `error` gives `{...state, pending: true}`, `'delayed'`. This comes **before** the pending guard, so a failed reload always schedules another retry.
  4. `state.pending` means any other frame is ignored: state unchanged, `'none'`. **There is only one reload at a time.**
  5. An `update` with `book?.symbol === sym && seq === book.seq + 1` sets each level and deletes size 0, `'none'`. Any other `update` (a gap, or no book yet) gives `{...state, pending: true}`, `'now'`. **The last good levels stay as they were.**
- `topLevels(book, n = 10) -> {bids: [price, size][], asks: [price, size][], maxSize: number}`. Bids are sorted descending, asks ascending, and `maxSize` is taken over the returned levels.
- `// ponytail: checksum (cs) not verified; seq gaps already force resync. Verify cs if desync is seen without a gap.`

- [ ] **Step 1: Write the failing tests:** `snapshot then next update applies` (a level at size 0 is gone and seq advances), `gap keeps last good book and asks resync` (this is the lesson's fold case: seq 10 receiving seq 12, giving `'now'`), `updates after a gap are ignored until the snapshot` (13, 14 and 15 then give `'none'` with the book unchanged; a snapshot clears `pending`), `several updates before the first snapshot ask exactly one resync` (`'now'` once, then `'none'`), `documented error frame recovers` (use Delta's exact shape `{action:'error', symbol:'BTCUSD', type:'ob_updates', msg:'Snapshot load failed…'}` unchanged, giving `'delayed'` and keeping the book), `snapshot → gap → error → error → snapshot` (`'now'`, `'delayed'`, `'delayed'`, then `pending` false), `late frames from the old focus are ignored`, and `topLevels sorts and caps`.
- [ ] **Step 2:** Run `npx vitest run src/delta/book.test.js` and expect FAIL.
- [ ] **Step 3:** Implement it. Prices stay as strings in the Map keys (their exact form from the feed), and only sizes become numbers.
- [ ] **Step 4:** Run again and expect PASS.
- [ ] **Step 5:** Propose the commit `feat: order book snapshot+delta fold with gap resync`.

### Task 4: `useDelta`, the connection lifecycle

**Files:**
- Create: `src/delta/useDelta.js`, `src/delta/useDelta.test.jsx`

**Interfaces:**
- Consumes: Task 2 (`subscribeMsg`, `unsubscribeMsg`, `parseTicker`, `backoffMs`, `SOCKET_URL`) and Task 3 (`applyBook`, `EMPTY_BOOK_STATE`).
- Produces: `useDelta(symbols: string[], focus: string|null) -> {status: 'connecting'|'live'|'reconnecting'|'stale', nowMs: number, lastMessageAt: number|null, retryInMs: number|null, tickers: Record<symbol, Ticker & {receivedAt:number, history: {price:number, ts:number}[]}>, book: Book|null, bookError: string|null, dropNow: () => void}`. It always constructs the native `WebSocket(SOCKET_URL)`; in demo mode MSW intercepts that constructor, so the hook doesn't know about demo mode.

Behavior the tests pin:
- On open it sends `enable_heartbeat`, then one `subscribe` containing `ticker` for `symbols` and `ob_updates` for `focus`. When `symbols` is empty it sends no ticker channel.
- When `symbols` or `focus` change on an open socket, it sends only the difference as `subscribe`/`unsubscribe`, with no reconnect. Keep the subscribed set in a ref.
- Each ticker frame appends `{price: last, ts}` to `history` (ts already in ms from `parseTicker`), capped at 300, and sets that coin's `receivedAt = Date.now()` even if its price is unchanged. The chart uses the real `ts`, never one reconstructed from the cadence. Rows slice the last 48 and the focus chart uses all 300. One shared 1 s interval in the hook updates `nowMs` for connection status, row ages and the focus stage; no row or pill starts its own clock. Clear this interval on unmount.
- On close, the status becomes `reconnecting`, `attempt` is incremented, and a timer is set for `backoffMs(attempt)`. `attempt` resets to 0 only after the socket has stayed open for `STABLE_MS = 10000`, using a timer started on open and cleared on close. An acknowledgement followed by a close therefore keeps backing off. Tickers are **kept**. The book is kept only if the focus hasn't changed, with `pending: true` until the new snapshot.
- Watchdog: if no frame of any kind (heartbeats included) arrives for 35 s, it closes the socket, which starts a reconnect. The status is `stale` only when the socket is open, `symbols` isn't empty, and the newest **ticker reception** among the currently watched symbols is more than 15 s old, using `receivedAt` and `nowMs`. Heartbeats come every 30 s, so they keep an empty watchlist `live` and never count as price freshness.
- Book frames go through `applyBook(bookState, msg, focus)`, kept in a ref and mirrored to React state. When the focus changes, the state becomes `EMPTY_BOOK_STATE` and any reload timer is cleared. `'now'` sends an unsubscribe and then a subscribe for `ob_updates[focus]`. `'delayed'` replaces any existing reload timer with one 3 s timer that does the same, so there's never more than one. That timer is cleared on a matching snapshot, focus change, close and unmount; its callback also checks that recovery is still pending for the same focus and open socket before sending. `bookError` is set to the copy "Order book out of sync, reloading…" while `pending`.
- On unmount it clears the timers and closes the socket (with no reconnect afterward).
- `dropNow()` calls `ws.close()`, and the normal path handles the rest.

- [ ] **Step 1: Write the failing tests** with MSW `ws.link(SOCKET_URL)` and `vi.useFakeTimers()`:
  - `subscribes watchlist and focus on open`
  - `keeps last prices while reconnecting, then resubscribes`
  - `diff-subscribes when a coin is added or removed`
  - `removing focused coin unsubscribes its book` (Review Focus 1)
  - `empty watchlist sends no ticker subscribe` (Review Focus 2)
  - `watchdog reconnects after 35s of silence` (Review Focus 5)
  - `gap triggers exactly one ob resubscribe for several later updates and keeps book`
  - `recovery error retries once after 3s, then a snapshot clears the error message`
  - `error followed by a snapshot before 3s cancels the reload and sends no extra subscription`
  - `a silent BTC ticker retains receivedAt while ETH and heartbeats continue, and the shared clock advances past 15s`
  - `an unchanged-price ticker refreshes receivedAt`
  - `focus change drops old book and ignores late old-symbol frames`
  - `focus change cancels a pending 3s error recovery`
  - `open → ack → close cycles keep increasing the delay` (assert the 2nd delay is greater than the 1st and the 3rd greater than the 2nd, with `rand` stubbed)
  - `empty watchlist with heartbeats every 30s stays live`
  - `closes socket on unmount and never reconnects, with no shared clock interval left running`
- [ ] **Step 2:** Run `npx vitest run src/delta/useDelta.test.jsx` and expect FAIL.
- [ ] **Step 3:** Implement it. Keep the socket, timers and subscribed set in refs. Ticker state is updated with functional `setState`. Re-render is acceptable: a ticker arrives about every 5 s per symbol, and the book updates about 4 times a second for one symbol only.
- [ ] **Step 4:** Run again and expect PASS. Then run `npx vitest run` and expect everything green.
- [ ] **Step 5:** Propose the commit `feat: useDelta socket lifecycle with backoff, heartbeat watchdog and diff subscriptions`.

### Task 5: Offline demo (MSW browser mock)

**Files:**
- Create: `src/demo/handlers.js`, `src/demo/handlers.test.js`, `public/mockServiceWorker.js` (via `npx msw init public/ --save`)
- Modify: `src/main.jsx`, `package.json` (MSW worker-directory metadata written by `msw init`)

**Interfaces:**
- Consumes: `DEMO_RECORDINGS` and `PRODUCTS_SAMPLE` (Task 1), `SOCKET_URL` and `REST_URL` (Task 2).
- Produces: `demoHandlers` (an array: one `ws.link(SOCKET_URL)` connection handler plus `http.get(REST_URL + '/v2/products', …)` returning `{success: true, result: <only the recorded products>}`) and `simulateGap() -> void`. The WebSocket handler never calls `server.connect()`, so no original exchange connection is opened.

Behavior:
- Per connection, the handler keeps its own subscribed set and timers. It replies to `subscribe` with a `subscriptions` ack, then replays only subscribed BTCUSD/ETHUSD streams: recorded tickers cycled every 5 s, and for the subscribed book symbol a snapshot then recorded updates every 500 ms. Frames are cloned, `ts` is rebased to now (microseconds), and book `seq` numbers are consecutive. Prices and sizes stay as recorded. It sends heartbeats every 30 s after `enable_heartbeat`.
- `unsubscribe` stops that stream and any queued frame for it. Send a queued snapshot only if its symbol is still subscribed on that same open connection. A client close clears every timer and removes that connection from the set used by `simulateGap`.
- `simulateGap()` makes the next book update of every open connection skip one `seq`. When the hook resubscribes, the handler sends a fresh snapshot after 1 s and resumes consecutive updates.
- `src/main.jsx`: only inside the `?demo=1` branch, dynamically import both `./demo/handlers.js` and `msw/browser`, then await `setupWorker(...demoHandlers).start({ onUnhandledRequest: 'bypass', quiet: true })` before rendering. Pass the imported `simulateGap` to `<App onSimulateGap={simulateGap} />`. Live mode renders `<App />` without either import. `App` has no static import of `src/demo/` or MSW; the callback keeps the demo code out of the live entry's static import graph.
- If import or worker startup fails, show "Couldn't start demo data." with a "Retry" button that reloads this URL and a "Use live data" link. Do not render App or open a socket until startup succeeds. The demo is an exchange-independent replay once the local Vite server and assets are available; it does not install a general offline cache.
- `// ponytail: BTC/ETH recordings only; capture more symbols if the demo needs them.`

- [ ] **Step 1: Write the failing tests** in node with `server.use(...demoHandlers)` from `src/test-setup.js`, using a real `WebSocket(SOCKET_URL)` and fake timers: `subscribe gets an ack and data only for requested symbols`, `unsubscribe stops its stream and a delayed old-symbol snapshot`, `simulateGap skips exactly one seq and a resubscribe gets a snapshot 1s later`, `client close leaves no timers or retained connections`, and `products route returns only recorded coins`. Assert the recordings are unchanged after replay.
- [ ] **Step 2:** Run `npx vitest run src/demo` and expect FAIL.
- [ ] **Step 3:** Implement it. All recovery decisions stay in `useDelta` and `applyBook`.
- [ ] **Step 4:** Run `npm test` and expect PASS. Task 7 verifies browser interception after Task 6 connects the page to `useDelta`; the scaffold alone does not open a market socket.
- [ ] **Step 5:** Propose the commit `feat: offline demo mode with MSW replay and simulate gap`.

### Task 6: The page

**Files:**
- Create: `src/App.jsx` (replace the template), `src/components/Icon.jsx` (authored inline SVG `up`, `down`, `remove`: one 1.5px stroke, `currentColor`, `aria-hidden`; no Unicode glyphs or emoji as icons), `src/components/StatusPill.jsx`, `WatchRow.jsx`, `Sparkline.jsx`, `CoinPicker.jsx`, `FocusStage.jsx`, `SessionChart.jsx`, `OrderBook.jsx`, `src/App.test.jsx`, `src/components/WatchRow.test.jsx`, `src/components/StatusPill.test.jsx`, `src/components/OrderBook.test.jsx`
- Modify: `src/styles.css`

**Interfaces:** `App({onSimulateGap?: () => void})` consumes `useDelta` (Task 4), the callback supplied by main (Task 5), the watchlist functions and `isCryptoPerp`/`decimalsFromTick` (Task 2), and `topLevels` (Task 3). Pass `nowMs` from the hook to the pill, rows and focus stage. Products come from the same fetch in both modes; App does not import demo fixtures or handlers.

- `App`: holds `watchlist` (initialized lazily from `loadWatchlist`, saved on change) and `focus` (defaults to `watchlist[0]`; when the focus is removed it moves to the new first coin, or null). It fetches products once on mount: `REST_URL + '/v2/products?contract_types=perpetual_futures&states=live'`, filtered with `isCryptoPerp`. A failed fetch only disables the picker, with the copy "Couldn't load the coin list. Prices still stream." Read demo mode once from `new URLSearchParams(window.location.search).get('demo') === '1'`. In demo mode, start with `['BTCUSD', 'ETHUSD']` and skip all watchlist storage calls; the products fetch runs as usual and MSW answers it. Demo add/remove stays in memory. Show "Simulate gap" only in demo mode and call `onSimulateGap`; disable it until the focused book has loaded and while `bookError` indicates recovery. Explain the disabled state beside the control. The header links switch mode by page navigation and an always-visible "Demo data" label stays beside the pill even while its status is Live or Reconnecting.
- `StatusPill`: a dot plus a label (`Live`, `Reconnecting`, `Stale`) inside `<span role="status">`, so only state changes are announced. The ticking parts (`in 4s`, `2s ago`) sit in a sibling span **outside** the live region, derived from the hook's shared `nowMs`; the pill has no interval of its own.
- `WatchRow`: a `<button>` row (the whole row selects the coin) plus a separate remove button (`Icon name="remove"`) with `aria-label="Remove BTCUSD"`. The price flashes via `data-dir="up|down"`, keyed on the tick `ts`. With no ticker yet it shows "waiting for data" (Review Focus 4). If `nowMs - ticker.receivedAt > 15000`, retain the price and add "Last update Ns ago", where `N = Math.floor((nowMs - ticker.receivedAt) / 1000)`; use secondary text and keep this age outside any live region. A fresh ticker removes the warning. The select button has `aria-pressed={selected}`, and the row uses the selected styling defined above. An explicit selection reveals the stage on mobile as specified in Layout. It shows the up/down icon, visually hidden "up"/"down" text and a sign on the %.
- `Sparkline`: an SVG polyline of the last 48 points, 2px stroke, colored by the direction from the first to the last point, with `aria-hidden` (the row's text already gives the numbers).
- `CoinPicker`: a native `<input list>` with a `<datalist>` of the filtered symbols plus descriptions, and an Add button. The datalist only suggests; it doesn't restrict. The submit handler calls `addError(symbol.trim().toUpperCase(), watchlist, products)` and shows the returned reason inline (`aria-describedby`), or adds the coin. The button is pre-disabled for the full and not-loaded cases.
- `FocusStage`: the symbol plus "perp", the big price with `aria-live="polite"`, the mark price, the 24h change, `SessionChart` and `OrderBook`, plus `bookError` when set. Apply the same freshness warning as its row beside the price, outside the live price region, and expose a stage ref for mobile reveal.
- `SessionChart`: one series, so no legend; recessive grid; a crosshair line plus a tooltip (price, time) on pointer move with a hit area the full height of the chart. Follow dataviz `marks-and-anatomy.md` and `interaction.md`, and read both before writing it.
- `OrderBook`: two mirrored columns of 10, with bars as `transform: scaleX(size/maxSize)` and the price formatted with the product decimals. Label both sides "Price (USD)" and "Size (contracts)". Calculate the spread in this component from the first returned ask minus the first returned bid, using numeric prices before display rounding; render it at the centre with the product decimals, or "Spread unavailable" if either side is missing. No extra spread service or helper is needed.
- Numbers are formatted with `Intl.NumberFormat('en-US', {minimumFractionDigits: d, maximumFractionDigits: d})`, using one cached formatter per decimal count.

- [ ] **Step 1: Write the failing tests:** in `WatchRow.test.jsx`, `shows waiting state without a ticker`, `up tick shows the up icon, hidden "up" text and + sign, not color alone`, `selected row exposes aria-pressed independently from keyboard focus`, and `at age 16s the price stays visible with Last update 16s ago, then a fresh ticker removes the warning`. In `StatusPill.test.jsx`, assert `ticking age is outside the status live region`. In `OrderBook.test.jsx`, bids 100/99 and asks 100.5/101 with `d=2` must show "Spread 0.50 USD" and the units, a locked book must show zero spread, and a missing side must show "Spread unavailable". In `App.test.jsx`, stream ETH every 5 s but stop BTC: the pill remains Live while BTC alone gets an age warning; also assert demo mode skips storage, labels its data, and supports removing/re-adding a recorded coin using the demo MSW handlers installed by the test. Assert the supplied `onSimulateGap` callback fires only when a focused book is available and not recovering. Spy on `Element.prototype.scrollIntoView`: at 390px an explicit selection calls it with `behavior: 'smooth'` (or `'auto'` when `matchMedia('(prefers-reduced-motion: reduce)')` matches), keeps focus on the select button, and at 1440px or on automatic focus changes it isn't called.
- [ ] **Step 2:** Run `npx vitest run src/App.test.jsx src/components` and expect FAIL.
- [ ] **Step 3:** Build the components and the styles following the design direction. Read `impeccable/reference/craft-floor.md` right before editing the UI.
- [ ] **Step 4:** Run `npx vitest run` and expect PASS. Then in `npm run dev`, screenshot at 1440×900 and 390×844 and look at them (the impeccable/frontend-design critique pass). Check the Design and writing checks above against the rendered page, including the selected row with keyboard focus elsewhere, a simultaneous price flash, one stale coin, the labelled spread and the Demo data header. At mobile size, confirm the stage is readable after selection and columns remain aligned. Fix the issues found, then inspect the render again once.
- [ ] **Step 5:** Run the web-design-guidelines review (fetch `command.md`, review `src/**/*.jsx` and `src/styles.css`) and fix the findings.
- [ ] **Step 6:** Propose the commit `feat: watchlist UI with demo mode, freshness and labelled order book`.

### Task 7: E2E drop/reconnect + paperwork

**Files:**
- Create: `playwright.config.js` (webServer `npm run dev`), `e2e/reconnect.spec.js`, `e2e/demo.spec.js`, `e2e/mobile.spec.js`, `README.md`, `docs/ai-declaration-log.md`

- [ ] **Step 1: Write the E2E tests:**
  - `e2e/reconnect.spec.js`: with `page.routeWebSocket(SOCKET_URL, ws => …)` and the products fixture route, assert `Live → Simulate drop → Reconnecting with the last price visible → Live`. Use a fresh context with service workers blocked for this Playwright-mocked live test. Assert the live page requests no demo/MSW modules or worker script. This is the lesson's "Studio test".
  - `e2e/demo.spec.js`: use a separate fresh context with `serviceWorkers: 'allow'`. Install a browser-context route that allows local assets and aborts/counts external network attempts, including requests forwarded by the worker; a page-level route alone cannot check worker traffic. Observe actual exchange WebSocket connections and require none. Do not mock the socket with Playwright: use the app's MSW replay. Assert "Demo data" stays visible through normal ticks, Simulate gap (recovery message appears and clears), and Simulate drop (Reconnecting, then Live), with the last price retained and zero external network attempts. Seed a saved live watchlist and assert its stored value is unchanged after demo add/remove. Abort the local `mockServiceWorker.js` request in another fresh context: the startup error and Retry/Use live data controls must appear, with no App socket. Finally test navigation from demo to live online with Playwright's exchange routes installed: the demo label disappears and live subscriptions resume.
  - `e2e/mobile.spec.js`: use the Playwright-mocked live mode, a 390×844 viewport and 20 saved test symbols with matching cloned ticker/book frames. Select a lower row and assert the stage heading for its symbol enters the viewport while the selecting button retains focus. Repeat under reduced motion. Keep the Task 6 spy test for the scroll options; this browser test verifies the actual layout.
- [ ] **Step 2:** Run `npm run e2e` and expect PASS (Chromium). Then run `npm test` and expect it to discover only the `src/` tests (none from `e2e/`). Run `npm run build` and expect PASS; check that the demo handlers and `msw/browser` remain behind the conditional dynamic imports.
- [ ] **Step 3:** Write `README.md`: what it is, `npm i && npm run dev`, tests, the data source and limits, the reconnect strategy and why (backoff plus jitter because of the 150 per 5 min limit; heartbeat watchdog), the connection states, and how the delta order book maps to the lesson's `applyFrame`. Document `http://localhost:5173/?demo=1`, its visible data label, the two supported symbols, the Simulate gap and Simulate drop buttons, and the fact that it never updates the live saved watchlist. Explain per-coin age warnings, mobile selection behavior, and that order sizes are contracts and spread is ask minus bid. Add one captured frame, as the lab asks. Write `docs/ai-declaration-log.md` with the lesson's ACCEPT/REJECT table, one row per AI-assisted change.
- [ ] **Step 4:** Do a final manual check against the live feed: leave it open for 2 min with the focus on BTCUSD, toggle Wi-Fi off and on, and add and remove a coin. Expect no console errors and the book to recover. Then load demo mode with Wi-Fi off, click Simulate gap and Simulate drop, and expect the same UI recovery. Check the mobile reveal once with reduced motion enabled.
- [ ] **Step 5:** Run anti-slop-write with the docs profile over the README, AI log and authored UI copy. Follow the Design and writing checks above. Replace generic claims with the app's actual behavior, use direct verbs and remove repeated introductions or conclusions. Keep the no-em-dash and no-middle-dot UI/doc copy rules, while preserving literal command flags and quoted source material. Check exact labels, units, timing values and test expectations after copy edits. Complete the skill's independent verification pass, review its findings and fix confirmed misses; inspect the changed UI strings in the rendered page.
- [ ] **Step 6:** Propose the commit `test: e2e reconnect; docs: README and AI declaration log`.
