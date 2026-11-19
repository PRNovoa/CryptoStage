import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import FocusStage from './FocusStage.jsx'

const props = { symbol: 'BTCUSD', name: 'Bitcoin', ticker: undefined, book: null, bookError: null, decimals: 1, nowMs: 0, headingRef: { current: null } }

test('the order book recovery message is announced', () => {
  render(<FocusStage {...props} bookError="Order book out of sync, reloading…" />)
  expect(screen.getByRole('status').textContent).toBe('Order book out of sync, reloading…')
  expect(screen.getByText('Waiting for data')).toBeTruthy()
})

test("another coin's book is never shown under this coin's name", () => {
  const eth = { symbol: 'ETHUSD', seq: 1, bids: new Map([['1700', 1]]), asks: new Map([['1701', 1]]) }
  render(<FocusStage {...props} book={eth} />)
  expect(screen.queryByText('1,700.0 USD')).toBeNull()
  expect(screen.getByText('Loading the order book…')).toBeTruthy()
})

test('mark price and 24h change are labelled', () => {
  const ticker = { symbol: 'BTCUSD', last: 101, mark: 100.5, open24h: 100, change24hPct: 1, ts: 1, receivedAt: 0, history: [] }
  render(<FocusStage {...props} ticker={ticker} />)
  expect(screen.getByText('Mark price').nextSibling.textContent).toBe('100.5 USD')
  expect(screen.getByText('24h change').nextSibling.textContent).toContain('+1.00%')
})
