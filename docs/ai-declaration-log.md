# AI declaration log

The project was planned with Claude (Claude Code) and Codex, and Claude wrote the code. Each row records one AI-assisted change, whether it was accepted or rejected, and the check that decided it.

| Date | Change | Tool | Decision | Check |
|---|---|---|---|---|
| 2026-11-19 | Plan: browser connects straight to Delta, with no relay server | Claude | ACCEPT | Live probe of `wss://public-socket.india.delta.exchange` returned ticker and order-book frames |
| 2026-11-19 | Stock filter on the `BUSD` symbol suffix | Claude | REJECT | Codex audit showed it drops BNBUSD; the live product list showed it also drops ARBUSD, 1000SHIBUSD, TRBUSD, LABUSD and BBUSD |
| 2026-11-19 | Stock filter on the product description (`/stock/i`) | Claude | ACCEPT | Matched all 57 tokenized stocks and no crypto in the live list |
| 2026-11-19 | Reset backoff on the first message after reconnecting | Claude | REJECT | Codex audit: a server that acknowledges and then closes would reset the delay every time |
| 2026-11-19 | Reset backoff after 10 s of stable connection | Claude | ACCEPT | Test `open → ack → close cycles keep increasing the delay` fails when the reset is immediate |
| 2026-11-19 | Order-book recovery: one reload at a time, `pending` kept apart from the book, errors retried after 3 s | Codex audit, Claude | ACCEPT | Tests in `src/delta/book.test.js` and `src/delta/useDelta.test.jsx`; the tests fail when the pending guard is removed |
| 2026-11-19 | Demo replay with a custom socket on a fixed timer | Codex | REJECT | Design review: it needed a socket factory in the hook and disconnected on a timer during a presentation. No code was written for it |
| 2026-11-19 | Demo mode with MSW, "Simulate gap" and "Simulate drop" | Claude, Codex | ACCEPT | `src/demo/handlers.test.js`, `e2e/demo.spec.js` |
| 2026-11-19 | Looping recorded book updates as captured | Claude | REJECT | Screenshot showed a crossed book (spread −3.0) |
| 2026-11-19 | Loop only recorded levels outside the snapshot spread | Claude | ACCEPT | Test `looped replay never crosses the book` |
| 2026-11-19 | Phone rows on one line | Claude | REJECT | 390 px screenshot showed the sparkline over the price |
| 2026-11-19 | Phone rows with the change under the price | Claude | ACCEPT | 390 px screenshot reviewed |
| 2026-11-19 | Mobile e2e selecting row T17 | Claude | REJECT | The test still passed with the scroll removed |
| 2026-11-19 | Mobile e2e selecting row T05, starting with the stage off screen | Claude | ACCEPT | Fails with the scroll removed, passes with it |
| 2026-11-19 | Watchdog that waits for the socket's close event | Claude | REJECT | Headless live run with the network cut stayed on Stale; on a dead network the close event does not arrive |
| 2026-11-19 | Watchdog that starts the reconnect itself | Claude | ACCEPT | Test `watchdog reconnects even when a dead network never delivers the close event`; the same run then showed Reconnecting and recovered |
| 2026-11-19 | Review fixes: watchdog also covers attempts that never open; a book waiting for a snapshot asks again every 3 s; focus moves to the next row after Remove; the recovery message is announced; flat sessions no longer repeat chart keys | Claude (code review by a second Claude agent) | ACCEPT | One failing test per fix first, then green: 64 unit tests |
| 2026-11-19 | First redesign: navy with neon cyan and amber, a techy display face, a floating dark card | Claude | REJECT | User review: read as AI-generated; matched the design skills' list of default looks |
| 2026-11-19 | Blue brand color for the redesign | Claude | REJECT | User review: blue also reads as a default |
| 2026-11-19 | Black and white with a brass accent, green up and red down, IBM Plex Sans only | Claude | ACCEPT | Colorblind validator passed both themes; text contrast at least 4.8:1 on the pills |
| 2026-11-19 | Chart tween starting from the empty placeholder | Claude | REJECT | Browser trace showed the scale flying in from 0 on the first real frame |
| 2026-11-19 | First chart frame snaps, later points animate | Claude | ACCEPT | Test `the first drawable frame appears in place instead of flying in from zero`; trace showed the scale easing over about 320 ms |
| 2026-11-19 | Phone list and detail as separate views with history | Claude | ACCEPT | `e2e/mobile.spec.js` with and without reduced motion |
| 2026-11-19 | Chakra Petch for prices | Claude | REJECT | fontTools: no `tnum` and proportional digits; prices use IBM Plex Sans 600 |

## Checks run

- `npm test`: 68 tests passed on 2026-11-19, after the redesign.
- `npm run e2e`: 6 tests passed on 2026-11-19.
- Headless run against the live feed on 2026-11-19: 60 s live, 37 s with the network cut (Reconnecting, last price kept), then Live again with a fresh order book; adding ARBUSD streamed. A second run after the review fixes logged Reconnecting at 40 s offline and Live with the recovery message cleared 6 s after the network returned.
- Manual check on a real device with Wi-Fi off and on: pending, to be done by the author.

## Publication verification (2026-11-19)

Codex updated the README to match the implemented market-depth view, theme and motion controls, compact layout and connection feedback. The earlier Checks run section records previous runs.

- `npm test`: 85 tests passed across 12 files.
- `npm run e2e`: 8 Chromium tests passed, covering reconnect, demo mode, startup failure, demo-to-live navigation, mobile navigation and preferences.
- `npm run lint`: passed.
- `npm run build`: passed.
- Candidate source and documentation files: no credential-pattern matches or personal absolute paths found. This scan is not a guarantee that every possible secret format is detected.
- A fresh manual live-feed and physical-device check was not performed for publication.
