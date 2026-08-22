import { useEffect, useRef, useState } from 'react'

export function useThrottledValue<T>(value: T, intervalMs: number): T {
  const [throttled, setThrottled] = useState(value)
  const latestRef = useRef(value)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    latestRef.current = value
    if (Object.is(value, throttled) || timerRef.current !== null) return
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      setThrottled(latestRef.current)
    }, intervalMs)
  }, [intervalMs, throttled, value])

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    },
    []
  )

  return throttled
}
