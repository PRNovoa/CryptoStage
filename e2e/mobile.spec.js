import { expect, test } from '@playwright/test'
import { mockExchange } from './exchange.js'

const SYMBOLS = Array.from({ length: 20 }, (_, i) => `T${String(i).padStart(2, '0')}USD`)

for (const reducedMotion of ['no-preference', 'reduce']) {
  test(`on a phone a coin opens as its own view and back returns to it (${reducedMotion})`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion, serviceWorkers: 'block', hasTouch: true })
    await mockExchange(context)
    await context.addInitScript((list) => localStorage.setItem('cryptostage.watchlist', list), JSON.stringify(SYMBOLS))
    const page = await context.newPage()
    await page.goto('/')
    await expect(page.locator('.conn [role="status"]')).toHaveText('')
    const row = page.getByRole('button', { name: /^T05/ })
    await row.tap()
    const heading = page.getByRole('heading', { name: 'T05', exact: true })
    await expect(heading).toBeInViewport()
    await expect(heading).toBeFocused()
    await expect(page.getByRole('heading', { name: 'Watchlist' })).not.toBeInViewport()
    await page.goBack()
    await expect(row).toBeFocused()
    await expect(row).toBeInViewport()
    await expect(heading).not.toBeInViewport()
    await context.close()
  })
}
