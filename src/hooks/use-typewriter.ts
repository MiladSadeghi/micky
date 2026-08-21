import { useEffect, useRef, useState } from 'react'
import { advanceReveal } from '@/lib/typewriter'

export function useTypewriter(target: string, enabled = true): string {
  const [shown, setShown] = useState(target)
  const shownRef = useRef(target)

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!enabled || reduceMotion) {
      shownRef.current = target
      setShown(target)
      return
    }
    let frame = 0
    const step = (): void => {
      const next = advanceReveal(shownRef.current, target)
      shownRef.current = next
      setShown(next)
      if (next !== target) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, enabled])

  return shown
}
