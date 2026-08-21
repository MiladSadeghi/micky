import { useEffect, useState } from 'react'
import type { SettingsSnapshot } from '@/lib/settings'
import { applyAppearance } from '@/lib/appearance'

export function useSettings(): SettingsSnapshot | null {
  const [snapshot, setSnapshot] = useState<SettingsSnapshot | null>(null)

  useEffect(() => {
    let active = true
    void window.api.settings.getSnapshot().then((next) => {
      if (active) {
        applyAppearance(next)
        setSnapshot(next)
      }
    })
    const unsubscribe = window.api.settings.onSnapshotChange((next) => {
      if (active) {
        applyAppearance(next)
        setSnapshot(next)
      }
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return snapshot
}
