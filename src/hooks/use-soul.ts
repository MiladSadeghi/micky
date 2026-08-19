import { useEffect, useState } from 'react'
import type { SoulSnapshot } from '@/lib/soul'

export function useSoul(): SoulSnapshot | null {
  const [snapshot, setSnapshot] = useState<SoulSnapshot | null>(null)

  useEffect(() => {
    let active = true
    void window.api.soul.getSnapshot().then((next) => {
      if (active) setSnapshot(next)
    })
    const unsubscribe = window.api.soul.onSnapshotChange((next) => {
      if (active) setSnapshot(next)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return snapshot
}
