import { useEffect, useRef, useState } from 'react'

// Motion is off when the visitor turns it off on the page or asks the system for reduced motion.
export const motionOff = () =>
  document.documentElement.dataset.motion === 'off' ||
  (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)

const easeOut = (p) => 1 - (1 - p) ** 3

// Runs 0 → 1 over `ms` each time `key` changes, then stops; no state updates between animations.
// It only animates when the previous key was also `active`: a first frame has nothing to animate from.
export function useProgress(key, ms, active = true) {
  const [p, setP] = useState(1)
  const wasActive = useRef(false)
  useEffect(() => {
    const animate = wasActive.current && active
    wasActive.current = active
    if (!animate || motionOff() || typeof requestAnimationFrame !== 'function') {
      setP(1)
      return
    }
    const start = performance.now()
    let frame
    const step = (now) => {
      const t = Math.min(1, (now - start) / ms)
      setP(easeOut(t))
      if (t < 1) frame = requestAnimationFrame(step)
    }
    setP(0)
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return p
}
