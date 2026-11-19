import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { http, HttpResponse, ws } from 'msw'
import { server } from './test-setup.js'
import { PRODUCTS_SAMPLE } from './delta/fixtures.js'
import { REST_URL, SOCKET_URL } from './delta/protocol.js'
import { demoHandlers } from './demo/handlers.js'
import App from './App.jsx'

const ticker = (sy, last) => ({ type: 'ticker', sy, ts: Date.now() * 1000, d: [{ s: sy, m: String(last), ohlc: [last, last, last, last] }] })
const snapshot = (sy) => ({ type: 'ob_updates', action: 'snapshot', sy, seq: 1, a: [['101', '5']], b: [['100', '4']] })
const watchRows = () => within(screen.getByRole('region', { name: 'Watchlist' })).getAllByRole('listitem')
const advance = (ms) => act(() => vi.advanceTimersByTimeAsync(ms))

let clients
function liveExchange() {
  clients = []
  server.use(
    http.get(REST_URL + '/v2/products', () => HttpResponse.json({ success: true, result: PRODUCTS_SAMPLE })),
    ws.link(SOCKET_URL).addEventListener('connection', ({ client }) => clients.push(client)),
  )
}
const push = (msg) => act(async () => { clients.at(-1).send(JSON.stringify(msg)); await vi.advanceTimersByTimeAsync(0) })

function setViewport({ width, reducedMotion = false }) {
  window.matchMedia = (q) => ({
    matches: (/max-width:\s*1023px/.test(q) && width < 1024) || (/prefers-reduced-motion:\s*reduce/.test(q) && reducedMotion),
    media: q, addEventListener() {}, removeEventListener() {},
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  window.history.replaceState({}, '', '/')
  localStorage.clear()
  localStorage.setItem('cryptostage.watchlist', JSON.stringify(['BTCUSD', 'ETHUSD']))
  setViewport({ width: 1440 })
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

test('a silent coin gets its own age warning while the connection stays healthy', async () => {
  liveExchange()
  render(<App />)
  await advance(0)
  await push(ticker('BTCUSD', 100))
  await push(ticker('ETHUSD', 50))
  for (let i = 0; i < 4; i++) {
    await advance(5000)
    await push(ticker('ETHUSD', 50 + i))
  }
  expect(document.querySelector('.conn [role="status"]').textContent).toBe('') // healthy: nothing shown
  const rows = watchRows()
  expect(within(rows[0]).getByText(/Last update \d+s ago/)).toBeTruthy()
  expect(within(rows[0]).getByText('100.0')).toBeTruthy()
  expect(within(rows[1]).queryByText(/Last update/)).toBeNull()
})

test('demo mode skips storage, labels its data and can remove and re-add a recorded coin', async () => {
  window.history.replaceState({}, '', '/?demo=1')
  server.use(...demoHandlers)
  const setItem = vi.spyOn(Storage.prototype, 'setItem')
  const getItem = vi.spyOn(Storage.prototype, 'getItem')
  render(<App onSimulateGap={() => {}} />)
  await advance(100)
  expect(screen.getByText('Demo data')).toBeTruthy()
  expect(watchRows()).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'Remove ETHUSD' }))
  expect(watchRows()).toHaveLength(1)
  fireEvent.change(screen.getByLabelText('Add coin'), { target: { value: 'ethusd' } })
  fireEvent.submit(screen.getByLabelText('Add coin').closest('form'))
  await advance(0)
  expect(watchRows()).toHaveLength(2)
  // MSW keeps its own cookie store in localStorage, so only the app's key is checked.
  const touched = (spy) => spy.mock.calls.some(([key]) => key === 'cryptostage.watchlist')
  expect(touched(setItem)).toBe(false)
  expect(touched(getItem)).toBe(false)
})

test('simulate gap fires only when the focused book is loaded and not recovering', async () => {
  window.history.replaceState({}, '', '/?demo=1')
  clients = []
  server.use(
    http.get(REST_URL + '/v2/products', () => HttpResponse.json({ success: true, result: PRODUCTS_SAMPLE.slice(0, 2) })),
    ws.link(SOCKET_URL).addEventListener('connection', ({ client }) => clients.push(client)),
  )
  const onSimulateGap = vi.fn()
  render(<App onSimulateGap={onSimulateGap} />)
  await advance(0)
  const gap = screen.getByRole('button', { name: 'Simulate gap' })
  expect(gap.disabled).toBe(true)
  expect(screen.getByText('Available once the order book loads.')).toBeTruthy()
  await push(snapshot('BTCUSD'))
  expect(gap.disabled).toBe(false)
  fireEvent.click(gap)
  expect(onSimulateGap).toHaveBeenCalledTimes(1)
  await push({ type: 'ob_updates', action: 'update', sy: 'BTCUSD', seq: 5, a: [], b: [] })
  expect(gap.disabled).toBe(true)
})

test('on a phone, picking a coin opens its detail view and Back returns to the row', async () => {
  liveExchange()
  setViewport({ width: 390 })
  render(<App />)
  await advance(0)
  const eth = screen.getByRole('button', { name: /^Ethereum/ })
  fireEvent.click(eth)
  await advance(0)
  expect(document.querySelector('.board').dataset.view).toBe('detail')
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Ethereum' }))
  expect(screen.getByRole('region', { name: 'Watchlist' }).closest('[inert]')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Watchlist' }))
  await act(async () => { window.dispatchEvent(new PopStateEvent('popstate')); await vi.advanceTimersByTimeAsync(0) })
  expect(document.querySelector('.board').dataset.view).toBe('list')
  expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Ethereum/ }))
})

test('on a desktop, picking a coin keeps both panels and adds no history entry', async () => {
  liveExchange()
  const push = vi.spyOn(window.history, 'pushState')
  render(<App />)
  await advance(0)
  fireEvent.click(screen.getByRole('button', { name: /^Ethereum/ }))
  await advance(0)
  expect(document.querySelector('.board').dataset.view).toBe('both')
  expect(screen.getByRole('heading', { name: 'Ethereum' })).toBeTruthy()
  expect(push).not.toHaveBeenCalled()
})

test('removing a coin moves keyboard focus to the next row', async () => {
  liveExchange()
  render(<App />)
  await advance(0)
  const remove = screen.getByRole('button', { name: 'Remove BTCUSD' })
  remove.focus()
  fireEvent.click(remove)
  await advance(0)
  expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Ethereum/ }))
})

test('theme and motion choices apply at once and are stored separately', async () => {
  liveExchange()
  render(<App />)
  await advance(0)
  const root = document.documentElement
  fireEvent.click(screen.getByRole('radio', { name: 'Dark' }))
  expect(root.dataset.theme).toBe('dark')
  expect(localStorage.getItem('cryptostage.theme')).toBe('dark')
  fireEvent.click(screen.getByRole('radio', { name: 'System' }))
  expect(root.dataset.theme).toBeUndefined()
  const motion = screen.getByRole('button', { name: 'Motion on' })
  expect(motion.getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(motion)
  expect(root.dataset.motion).toBe('off')
  expect(localStorage.getItem('cryptostage.motion')).toBe('off')
  expect(localStorage.getItem('cryptostage.theme')).toBe('system')
  expect(screen.getByRole('button', { name: 'Motion off' }).getAttribute('aria-pressed')).toBe('false')
  delete root.dataset.motion
})

test('the connection notice appears only while something is wrong', async () => {
  liveExchange()
  render(<App />)
  await advance(0)
  const notice = () => document.querySelector('.conn [role="status"]').textContent
  expect(notice()).toBe('')
  await act(async () => { clients.at(-1).close(1006, 'gone'); await vi.advanceTimersByTimeAsync(0) })
  expect(notice()).toBe('Reconnecting')
  await advance(1500)
  expect(notice()).toBe('')
})

test('selecting a coin swaps its name and its own quote together, never the old quote', async () => {
  liveExchange()
  render(<App />)
  await advance(0)
  await push(ticker('BTCUSD', 100))
  await push(ticker('ETHUSD', 50))
  const price = () => document.querySelector('.detail-price').textContent
  expect(price()).toBe('100.0')
  fireEvent.click(screen.getByRole('button', { name: /^Ethereum/ }))
  // Same render: the heading and the quote belong to the same coin.
  expect(screen.getByRole('heading', { name: 'Ethereum' })).toBeTruthy()
  expect(price()).toBe('50.00')
})
