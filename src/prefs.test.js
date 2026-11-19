import { expect, test, vi } from 'vitest'
import { applyPrefs, loadPref, MOTION, savePref, THEME } from './prefs.js'

const store = (v) => { let s = v; return { getItem: () => s, setItem: (_k, x) => { s = x } } }

test('loadPref accepts only known values and falls back otherwise', () => {
  expect(loadPref(THEME, store('dark'))).toBe('dark')
  expect(loadPref(THEME, store('purple'))).toBe('system')
  expect(loadPref(MOTION, store(null))).toBe('on')
  expect(loadPref(THEME, { getItem() { throw new Error('denied') } })).toBe('system')
})

test('a throwing localStorage getter never breaks loading or saving', () => {
  const spy = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('SecurityError') })
  expect(loadPref(THEME)).toBe('system')
  expect(() => savePref(THEME, 'dark')).not.toThrow()
  spy.mockRestore()
})

test('theme and motion are stored separately and round-trip', () => {
  const s = store(null)
  savePref(THEME, 'light', s)
  expect(loadPref(THEME, s)).toBe('light')
  const both = { data: {}, getItem(k) { return this.data[k] ?? null }, setItem(k, v) { this.data[k] = v } }
  savePref(THEME, 'dark', both)
  savePref(MOTION, 'off', both)
  expect([loadPref(THEME, both), loadPref(MOTION, both)]).toEqual(['dark', 'off'])
})

test('applyPrefs writes data attributes; system leaves the theme to the media query', () => {
  const el = document.createElement('html')
  applyPrefs({ theme: 'dark', motion: 'off' }, el)
  expect(el.dataset).toMatchObject({ theme: 'dark', motion: 'off' })
  applyPrefs({ theme: 'system', motion: 'on' }, el)
  expect(el.dataset.theme).toBeUndefined()
  expect(el.dataset.motion).toBe('on')
})
