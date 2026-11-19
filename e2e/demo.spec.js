import { expect, test } from '@playwright/test'
import { mockExchange } from './exchange.js'

const SAVED = JSON.stringify(['SOLUSD', 'XRPUSD'])
const isLocal = (url) => url.startsWith('http://localhost:5199') || url.startsWith('ws://localhost:5199')

async function demoContext(browser, { blockWorker = false } = {}) {
  const context = await browser.newContext({ serviceWorkers: 'allow' })
  const external = []
  await context.route('**/*', (route) => {
    const url = route.request().url()
    if (blockWorker && url.endsWith('/mockServiceWorker.js')) return route.abort()
    if (isLocal(url)) return route.continue()
    external.push(url)
    return route.abort()
  })
  await context.addInitScript((saved) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('cryptostage.watchlist', saved)
      sessionStorage.setItem('seeded', '1')
    }
  }, SAVED)
  const page = await context.newPage()
  const sockets = []
  page.on('websocket', (ws) => !isLocal(ws.url()) && sockets.push(ws.url()))
  return { context, page, external, sockets }
}

test('demo data survives a simulated gap and drop without touching the exchange', async ({ browser }) => {
  const { context, page, external, sockets } = await demoContext(browser)
  await page.goto('/?demo=1')
  const label = page.getByText('Demo data')
  const status = page.locator('.conn [role="status"]')
  await expect(label).toBeVisible()
  await expect(status).toHaveText('')
  const gap = page.getByRole('button', { name: 'Simulate gap' })
  await expect(gap).toBeEnabled()
  await gap.click()
  await expect(page.getByText('Order book out of sync, reloading…')).toBeVisible()
  await expect(page.getByText('Order book out of sync, reloading…')).toBeHidden()
  await expect(label).toBeVisible()

  const btcPrice = page.locator('.detail-price')
  const before = await btcPrice.textContent()
  await page.getByRole('button', { name: 'Simulate drop' }).click()
  await expect(status).toHaveText('Reconnecting')
  await expect(btcPrice).toHaveText(before)
  await expect(label).toBeVisible()
  await expect(status).toHaveText('')

  await page.getByRole('button', { name: 'Remove ETHUSD' }).click()
  await page.getByLabel('Add coin').fill('ETHUSD')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Remove ETHUSD' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('cryptostage.watchlist'))).toBe(SAVED)
  expect(external).toEqual([])
  expect(sockets).toEqual([])
  await context.close()
})

test('a failed mock startup offers retry or live data and opens no socket', async ({ browser }) => {
  const { context, page, sockets } = await demoContext(browser, { blockWorker: true })
  await page.goto('/?demo=1')
  await expect(page.getByText("Couldn't start demo data. No connection was opened.")).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Use live data' })).toHaveAttribute('href', '/')
  await expect(page.getByRole('heading', { name: 'Watchlist' })).toHaveCount(0)
  expect(sockets).toEqual([])
  await context.close()
})

test('leaving demo mode resumes live subscriptions', async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: 'allow' })
  const exchange = await mockExchange(context)
  const page = await context.newPage()
  await page.goto('/?demo=1')
  await expect(page.getByText('Demo data')).toBeVisible()
  expect(exchange).toHaveLength(0)
  await page.getByRole('link', { name: 'Use live data' }).click()
  await expect(page.getByText('Demo data')).toHaveCount(0)
  await expect(page.locator('.conn [role="status"]')).toHaveText('')
  await expect.poll(() => exchange.flatMap((s) => s.received).some((m) => m.type === 'subscribe')).toBe(true)
  await context.close()
})
