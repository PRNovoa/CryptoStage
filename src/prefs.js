// Theme and motion preferences, each stored under its own key. index.html applies them before first paint.
export const THEME = { key: 'cryptostage.theme', values: ['system', 'light', 'dark'], fallback: 'system' }
export const MOTION = { key: 'cryptostage.motion', values: ['on', 'off'], fallback: 'on' }

export function loadPref(pref, storage) {
  try {
    const v = (storage ?? window.localStorage).getItem(pref.key)
    return pref.values.includes(v) ? v : pref.fallback
  } catch {
    return pref.fallback
  }
}

export function savePref(pref, value, storage) {
  try {
    ;(storage ?? window.localStorage).setItem(pref.key, value)
  } catch {
    // Blocked storage: the choice lasts for this visit only.
  }
}

export function applyPrefs({ theme, motion }, el = document.documentElement) {
  if (theme === 'system') delete el.dataset.theme
  else el.dataset.theme = theme
  el.dataset.motion = motion
}
