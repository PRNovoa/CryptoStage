# CryptoStage design

This file is the current design direction. It replaces the design sections of `docs/superpowers/plans/2026-11-19-cryptostage.md` (palette, type, layout, selection, motion and the order-book ladder) and every later round of choices made in conversation. Data, connection and recovery behaviour in that plan still apply.

## Reference

Union Bancaire Privée (ubp.com) is the banking reference. A look at the live site on 2026-11-19 showed a deep teal brand colour, a high-contrast serif for headlines, a plain sans for body text, square corners and underlined text links. CryptoStage borrows that temperament, not UBP's styling: it is a live market page, not a bank brochure, and it keeps its own name and content.

## Composition

- No top bar, wordmark strip or enclosing box. The watchlist and the selected asset sit directly on the page colour.
- Content is at most 1440 px wide, with 48 px gutters and 48 px above the first line on desktop.
- Desktop (1024 px and wider): a 360 px watchlist, 64 px of space, then the selected asset in the remaining width.
- Below 1024 px: list and detail are separate views. The detail slides in, Back (link or browser) returns to the row that opened it, and focus moves with the view. Gutters are 20 px and charts run full width.
- Theme, Motion and the demo controls live in a quiet utility area at the foot of the page. The name "CryptoStage" appears there and in the page title.

## Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F5F3EE` ivory | `#171C19` charcoal | page |
| `--surface` | `#FFFFFF` | `#202822` | tooltips |
| `--ink` | `#242923` | `#EEF0E8` | text, chart line |
| `--ink-2` | `#646B63` | `#AAB5A8` | secondary text, sparklines |
| `--line` | `#DDDFD6` | `#38443B` | dividers, gridlines |
| `--brass` | `#7F6128` | `#CDA85E` | selected controls, link underlines, the demo label |
| `--up` / `--up-text` | `#00826F` / `#00705F` | `#1FA595` | bids and gains |
| `--down` / `--down-text` | `#BC4A2E` / `#A8402A` | `#D2714F` / `#D97B5A` | asks and losses |

The teal and brick pairs passed the dataviz colour validator in both themes (worst colour-vision separation ΔE 10.6 light, 10.6 dark). Every text token reaches 4.5:1 on the page colour. Direction is never colour alone: every change has an arrow icon and a sign, and screen readers hear "up" or "down".

Theme can be System, Light or Dark. The choice is stored under `cryptostage.theme`, separately from Motion, and an inline script in `index.html` applies it before the first paint.

## Type

- Georgia (serif fallback) for the selected asset's name only.
- IBM Plex Sans, self-hosted, for everything else: prices, tables, controls.
- All financial numbers use tabular figures, so digits don't shift as prices change.
- No pill backgrounds, badges or ornamental framing. Selection is a quiet background and a heavier name; keyboard focus is a separate 2 px outline.

## Motion

One system, built on CSS, SVG and the `useProgress` hook in `src/motion.js`. No animation library.

| Moment | Behaviour |
|---|---|
| First load | Content fades up from 12 px over 500 ms. Controls work at once. |
| Selecting an asset | Name, quote, chart and depth crossfade together over 240 ms, so an old price never sits under a new name. |
| New chart point | The scale and every historical point are exact at once; only the newest segment draws out toward the new point over 300 ms. No intermediate samples are invented. |
| Quote change | The number changes at once and tints toward its direction briefly. |
| Market depth | The stepped shapes ease over 180 ms (CSS `d` transition, interruptible). Labels and accessible values update at once. |
| Controls | Underline thickness, colour and a 0.97 press. Keyboard actions are immediate. |
| Ambient | Two thin contour lines in the outer margins drift on an 18 s cycle. Desktop only, behind everything, never over data, no React re-renders. They pause when the tab is hidden. |

The Motion control (stored under `cryptostage.motion`) and the system's reduced-motion setting both stop ambient drift, slides, reveals, chart drawing and depth easing. Colour feedback stays.

## Market depth

The order-book ladder is replaced by a depth section under the session chart. The snapshot and delta logic is unchanged.

- A summary first: Best bid, Spread and Best ask, in USD. A missing side reads "Unavailable".
- Opposing cumulative depth for the ten nearest levels on each side. Price runs horizontally and cumulative contracts vertically. The shapes are stepped at the real price levels and stop at the last level shown, and a caption states the exact range.
- Pointer and arrow keys (Home and End too) read the exact price and cumulative contracts of a level.
- "Price levels" is a collapsed disclosure with five levels per side in labelled Bids and Asks tables.
- During recovery the last valid depth stays with the recovery message. A book is drawn only for the coin it belongs to.

## Connection feedback

Nothing is shown while the stream is healthy. "Connecting", "Reconnecting" (with a countdown) and "Stale" appear above the watchlist only when they apply; the live region stays mounted so the change is announced. Per-coin "Last update Ns ago" warnings and the "Demo data" label stay.
