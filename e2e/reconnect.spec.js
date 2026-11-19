import { expect, test } from '@playwright/test'
import { mockExchange } from './exchange.js'

test.use({ serviceWorkers: 'block' })

test('healthy → Simulate drop → Reconnecting with the last price visible → healthy', async ({ page, context }) => {
  const sockets = await mockExchange(context)
  const demoRequests = []
  page.on('request', (r) => /\/src\/demo\/|msw|mockServiceWorker/.test(r.url()) && demoRequests.push(r.url()))
  await page.goto('/')
  const status = page.locator('.conn [role="status"]')
  await expect(page.getByRole('button', { name: /^Bitcoin/ })).toContainText('100.0')
  await expect(status).toHaveText('')
  const btc = page.getByRole('region', { name: 'Watchlist' }).getByRole('listitem').first()
  await expect(btc).toContainText('100.0')

  const opened = sockets.length // dev StrictMode mounts twice, so count from here
  await page.getByRole('button', { name: 'Simulate drop' }).click()
  await expect(status).toHaveText('Reconnecting')
  await expect(btc).toContainText('100.0')
  await expect(status).toHaveText('')
  expect(sockets.length).toBe(opened + 1)
  expect(sockets.at(-1).received.some((m) => m.type === 'subscribe')).toBe(true)
  expect(demoRequests).toEqual([])
})
