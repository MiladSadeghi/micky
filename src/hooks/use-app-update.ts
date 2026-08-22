import { useEffect, useState } from 'react'
import type { AppUpdateSnapshot } from '@/lib/app-update'

export function useAppUpdate(): AppUpdateSnapshot | null {
  const [snapshot, setSnapshot] = useState<AppUpdateSnapshot | null>(null)

  useEffect(() => {
    let active = true
    void window.api.updates.getSnapshot().then((next) => {
      if (active) setSnapshot(next)
    })
    const unsubscribe = window.api.updates.onSnapshotChange((next) => {
      if (active) setSnapshot(next)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return snapshot
}
