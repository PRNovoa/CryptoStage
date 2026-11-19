import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import WatchRow from './WatchRow.jsx'

const ticker = (prices, receivedAt = 1000) => ({
  symbol: 'BTCUSD', last: prices.at(-1), mark: prices.at(-1), open24h: 100, change24hPct: ((prices.at(-1) - 100) / 100) * 100,
  ts: receivedAt, receivedAt, history: prices.map((price, i) => ({ price, ts: i })),
})
const row = (props) => render(<ul><WatchRow symbol="BTCUSD" decimals={1} nowMs={1000} selected={false} onSelect={() => {}} onRemove={() => {}} {...props} /></ul>)

test('shows waiting state without a ticker', () => {
  row({ ticker: undefined })
  expect(screen.getByText('Waiting for data')).toBeTruthy()
  expect(screen.queryByText(/NaN|\b0\.0\b/)).toBeNull()
  expect(screen.getByRole('button', { name: 'Remove BTCUSD' })).toBeTruthy()
})

test('up tick shows the up icon, hidden "up" text and + sign, not color alone', () => {
  const { container } = row({ ticker: ticker([100, 101.5]) })
  expect(container.querySelector('svg[data-icon="up"]')).toBeTruthy()
  expect(screen.getByText('up').className).toContain('sr-only')
  expect(screen.getByText('+1.50%')).toBeTruthy()
})

test('selected row exposes aria-pressed independently from keyboard focus', () => {
  row({ ticker: ticker([100]), selected: true })
  const select = screen.getByRole('button', { pressed: true })
  screen.getByRole('button', { name: 'Remove BTCUSD' }).focus()
  expect(select.getAttribute('aria-pressed')).toBe('true')
  expect(document.activeElement).not.toBe(select)
})

test('at age 16s the price stays visible with Last update 16s ago, then a fresh ticker removes the warning', () => {
  const { rerender } = row({ ticker: ticker([100, 101]), nowMs: 17000 })
  expect(screen.getByText('101.0')).toBeTruthy()
  expect(screen.getByText('Last update 16s ago')).toBeTruthy()
  rerender(<ul><WatchRow symbol="BTCUSD" decimals={1} nowMs={17000} selected={false} onSelect={() => {}} onRemove={() => {}} ticker={ticker([100, 101, 102], 16900)} /></ul>)
  expect(screen.queryByText(/Last update/)).toBeNull()
})
