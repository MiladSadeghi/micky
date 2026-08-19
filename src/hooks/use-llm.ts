import { useEffect, useState } from 'react'
import type { LlmSnapshot } from '@/lib/llm'

export function useLlm(): LlmSnapshot | null {
  const [snapshot, setSnapshot] = useState<LlmSnapshot | null>(null)

  useEffect(() => {
    let active = true
    void window.api.llm.getSnapshot().then((next) => {
      if (active) setSnapshot(next)
    })
    const unsubscribe = window.api.llm.onSnapshotChange((next) => {
      if (active) setSnapshot(next)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return snapshot
}
