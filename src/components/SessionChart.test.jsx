import { afterEach, expect, test, vi } from 'vitest'
import { render } from '@testing-library/react'
import SessionChart from './SessionChart.jsx'

const tip = (c) => c.querySelector('.chart-line').getAttribute('points').split(' ').at(-1)
const ticks = (c) => [...c.querySelectorAll('.chart-tick')].map((t) => t.textContent)
const pts = [{ price: 100, ts: 0 }, { price: 110, ts: 1000 }]

afterEach(() => {
  vi.useRealTimers()
  delete window.matchMedia
  delete document.documentElement.dataset.motion
})

test('a flat session renders without duplicate keys', () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  render(<SessionChart points={[{ price: 100, ts: 1 }, { price: 100, ts: 2 }]} decimals={1} />)
  expect(error.mock.calls.some(([m]) => /same key/.test(String(m)))).toBe(false)
  error.mockRestore()
})

test('a new point: the scale is exact at once and only the line tip travels to it over 300ms', async () => {
  vi.useFakeTimers()
  const { container, rerender } = render(<SessionChart points={pts} decimals={1} />)
  rerender(<SessionChart points={[...pts, { price: 90, ts: 2000 }]} decimals={1} />)
  await vi.advanceTimersByTimeAsync(0)
  expect(ticks(container)).toEqual(['110.0', '100.0', '90.0']) // never an interpolated axis value
  const start = tip(container)
  expect(start).toBe('300.0,10.0') // the previous newest point, drawn in the new scale
  await vi.advanceTimersByTimeAsync(150)
  const mid = tip(container)
  expect(mid).not.toBe(start)
  await vi.advanceTimersByTimeAsync(200)
  expect(tip(container)).toBe('600.0,170.0')
})

test('the first drawable frame appears in place', async () => {
  vi.useFakeTimers()
  const { container, rerender } = render(<SessionChart points={[{ price: 100, ts: 0 }]} decimals={1} />)
  rerender(<SessionChart points={[{ price: 100, ts: 0 }, { price: 90, ts: 1000 }]} decimals={1} />)
  await vi.advanceTimersByTimeAsync(0)
  expect(tip(container)).toBe('600.0,170.0')
})

test('reduced motion and the Motion off setting both draw the new point at once', async () => {
  for (const setup of [() => { window.matchMedia = (q) => ({ matches: /reduce/.test(q) }) }, () => { document.documentElement.dataset.motion = 'off' }]) {
    setup()
    const { container, rerender, unmount } = render(<SessionChart points={pts} decimals={1} />)
    rerender(<SessionChart points={[...pts, { price: 90, ts: 2000 }]} decimals={1} />)
    expect(tip(container)).toBe('600.0,170.0')
    unmount()
    delete window.matchMedia
    delete document.documentElement.dataset.motion
  }
})

test('arrow keys read the exact recorded point', async () => {
  const { container, getByRole } = render(<SessionChart points={[...pts, { price: 90, ts: 2000 }]} decimals={1} />)
  const plot = getByRole('img')
  plot.focus()
  plot.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
  await Promise.resolve()
  expect(container.querySelector('.chart-readout').textContent).toMatch(/^110\.0 USD at /)
})

test('a newer point interrupts the running animation and unmounting leaves nothing running', async () => {
  vi.useFakeTimers()
  const { container, rerender, unmount } = render(<SessionChart points={pts} decimals={1} />)
  const more = [...pts, { price: 90, ts: 2000 }]
  rerender(<SessionChart points={more} decimals={1} />)
  await vi.advanceTimersByTimeAsync(100)
  rerender(<SessionChart points={[...more, { price: 120, ts: 3000 }]} decimals={1} />)
  await vi.advanceTimersByTimeAsync(400)
  expect(tip(container)).toBe('600.0,10.0')
  rerender(<SessionChart points={[...more, { price: 120, ts: 3000 }, { price: 95, ts: 4000 }]} decimals={1} />)
  await vi.advanceTimersByTimeAsync(50)
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})

test('the tooltip stays inside the plot at both edges', async () => {
  const many = Array.from({ length: 11 }, (_, i) => ({ price: 100 + i, ts: i * 1000 }))
  const { container, getByRole } = render(<SessionChart points={many} decimals={1} />)
  const plot = getByRole('img')
  plot.getBoundingClientRect = () => ({ left: 0, top: 0, width: 600, height: 280, right: 600, bottom: 280 })
  const align = () => container.querySelector('.chart-tip').dataset.align
  const { fireEvent } = await import('@testing-library/react')
  fireEvent.pointerMove(plot, { clientX: 599 })
  expect(align()).toBe('end')
  fireEvent.pointerMove(plot, { clientX: 1 })
  expect(align()).toBe('start')
  fireEvent.pointerMove(plot, { clientX: 300 })
  expect(align()).toBe('center')
  expect(container.querySelector('.chart-tip').textContent).toMatch(/^105\.0/)
})
