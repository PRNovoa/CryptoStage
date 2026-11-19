import { expect, test } from '@playwright/test'
import { mockExchange } from './exchange.js'

test.use({ serviceWorkers: 'block' })

test('a saved dark theme is applied before the first paint', async ({ page, context }) => {
  await mockExchange(context)
  await context.addInitScript(() => localStorage.setItem('cryptostage.theme', 'dark'))
  await page.goto('/')
  // index.html's inline script runs before React; the attribute and colours are already dark.
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark')
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(16, 24, 32)')
})

test('Motion off stops the arrival and selection animations', async ({ page, context }) => {
  await mockExchange(context)
  await page.goto('/')
  const anim = () => page.evaluate(() => getComputedStyle(document.querySelector('.detail-body')).animationName)
  expect(await anim()).toBe('arrive')
  await page.getByRole('button', { name: 'Motion on' }).click()
  expect(await anim()).toBe('none')
})
