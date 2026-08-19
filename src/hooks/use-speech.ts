import { useEffect, useState } from 'react'
import type { SpeechStatus } from '@/lib/asr'

export function useSpeech(): SpeechStatus | null {
  const [status, setStatus] = useState<SpeechStatus | null>(null)

  useEffect(() => {
    let active = true
    void window.api.speech.getStatus().then((next) => {
      if (active) setStatus(next)
    })
    const unsubscribe = window.api.speech.onStatusChange((next) => {
      if (active) setStatus(next)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return status
}
