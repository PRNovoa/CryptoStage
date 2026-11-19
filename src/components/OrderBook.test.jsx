import { expect, test } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import OrderBook from './OrderBook.jsx'

const book = (bids, asks) => ({ symbol: 'X', seq: 1, bids: new Map(bids), asks: new Map(asks) })
const sample = book([['100', 4], ['99', 2]], [['100.5', 1], ['101', 3]])
const summary = (label) => within(screen.getByRole('group', { name: 'Book summary' })).getByText(label).nextSibling.textContent

test('the summary states best bid, spread and best ask in USD', () => {
  render(<OrderBook book={sample} decimals={2} />)
  expect(summary('Best bid')).toBe('100.00 USD')
  expect(summary('Spread')).toBe('0.50 USD')
  expect(summary('Best ask')).toBe('100.50 USD')
})

test('a locked book shows zero spread and a missing side says so', () => {
  const { unmount } = render(<OrderBook book={book([['100', 4]], [['100', 1]])} decimals={2} />)
  expect(summary('Spread')).toBe('0.00 USD')
  unmount()
  render(<OrderBook book={book([['100', 4]], [])} decimals={2} />)
  expect(summary('Best ask')).toBe('Unavailable')
  expect(summary('Spread')).toBe('Unavailable')
})

test('the depth chart labels the range it actually shows', () => {
  render(<OrderBook book={sample} decimals={2} />)
  expect(screen.getByText('Cumulative depth of the nearest 2 bid and 2 ask levels, 99.00 to 101.00 USD')).toBeTruthy()
})

test('arrow keys inspect each level with its exact price and cumulative size', () => {
  render(<OrderBook book={sample} decimals={2} />)
  const chart = screen.getByRole('img', { name: /Market depth/ })
  fireEvent.keyDown(chart, { key: 'ArrowRight' })
  expect(screen.getByTestId('depth-readout').textContent).toBe('Bid at 99.00 USD: 6 contracts cumulative')
  fireEvent.keyDown(chart, { key: 'End' })
  expect(screen.getByTestId('depth-readout').textContent).toBe('Ask at 101.00 USD: 4 contracts cumulative')
  fireEvent.keyDown(chart, { key: 'ArrowLeft' })
  expect(screen.getByTestId('depth-readout').textContent).toBe('Ask at 100.50 USD: 1 contract cumulative')
})

test('price levels sit in a collapsed disclosure with labelled tables of five levels', () => {
  const many = book(Array.from({ length: 8 }, (_, i) => [String(100 - i), 1]), Array.from({ length: 8 }, (_, i) => [String(101 + i), 1]))
  const { container } = render(<OrderBook book={many} decimals={1} />)
  const details = container.querySelector('details')
  expect(details.open).toBe(false)
  expect(within(details).getByText('Price levels')).toBeTruthy()
  const [bids, asks] = within(details).getAllByRole('table')
  expect(within(bids).getByText('Bids')).toBeTruthy()
  expect(within(asks).getByText('Asks')).toBeTruthy()
  expect(within(bids).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Price (USD)', 'Size (contracts)'])
  expect(within(bids).getAllByRole('row')).toHaveLength(6)
  expect(within(bids).getAllByRole('row')[1].textContent).toContain('100.0')
})

test('the depth chart has explicit price and cumulative-contract axes and labelled sides', () => {
  const { container } = render(<OrderBook book={sample} decimals={2} />)
  const fig = within(container.querySelector('.depth-figure'))
  expect(fig.getByText('Cumulative contracts')).toBeTruthy()
  expect(fig.getByText('6')).toBeTruthy() // the largest cumulative size on either side
  expect(fig.getByText('Price (USD)')).toBeTruthy()
  expect(fig.getByText('99.00')).toBeTruthy()
  expect(fig.getByText('101.00')).toBeTruthy()
  expect(fig.getByText('Bids')).toBeTruthy()
  expect(fig.getByText('Asks')).toBeTruthy()
})

test('the summary puts the spread in the centre', () => {
  render(<OrderBook book={sample} decimals={2} />)
  const items = [...screen.getByRole('group', { name: 'Book summary' }).children].map((c) => c.firstChild.textContent)
  expect(items).toEqual(['Best bid', 'Spread', 'Best ask'])
})
