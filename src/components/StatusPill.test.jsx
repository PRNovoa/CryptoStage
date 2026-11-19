import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatusPill from './StatusPill.jsx'

test('a healthy stream shows nothing and has no ticking counter', () => {
  const { container } = render(<StatusPill status="live" nowMs={5000} lastMessageAt={3000} retryInMs={null} />)
  expect(screen.getByRole('status').textContent).toBe('')
  expect(container.textContent).toBe('')
})

test('reconnecting shows the retry countdown outside the live region', () => {
  render(<StatusPill status="reconnecting" nowMs={5000} lastMessageAt={3000} retryInMs={3200} />)
  const live = screen.getByRole('status')
  expect(live.textContent).toBe('Reconnecting')
  const detail = screen.getByText('in 4s')
  expect(live.contains(detail)).toBe(false)
})
