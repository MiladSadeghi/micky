import { useEffect, useState } from 'react'
import type { WebSearchSnapshot } from '@/lib/web-search'

export function useWebSearch(): WebSearchSnapshot | null {
  const [snapshot, setSnapshot] = useState<WebSearchSnapshot | null>(null)

  useEffect(() => {
    let active = true
    void window.api.webSearch.getSnapshot().then((next) => {
      if (active) setSnapshot(next)
    })
    const unsubscribe = window.api.webSearch.onSnapshotChange((next) => {
      if (active) setSnapshot(next)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return snapshot
}
