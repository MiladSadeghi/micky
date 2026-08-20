import { useEffect, useState } from 'react'
import type { SettingsSnapshot } from '@/lib/settings'

export function useSettings(): SettingsSnapshot | null {
  const [snapshot, setSnapshot] = useState<SettingsSnapshot | null>(null)

  useEffect(() => {
    let active = true
    void window.api.settings.getSnapshot().then((next) => {
      if (active) setSnapshot(next)
    })
    const unsubscribe = window.api.settings.onSnapshotChange((next) => {
      if (active) setSnapshot(next)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return snapshot
}
