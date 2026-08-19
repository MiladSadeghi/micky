import { useEffect, useState } from 'react'
import type { ModelsSnapshot } from '../../../shared/asr'

export function useModels(): ModelsSnapshot | null {
  const [snapshot, setSnapshot] = useState<ModelsSnapshot | null>(null)

  useEffect(() => {
    let active = true
    void window.api.models.getStatus().then((next) => {
      if (active) setSnapshot(next)
    })
    const unsubscribe = window.api.models.onStatusChange((next) => {
      if (active) setSnapshot(next)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return snapshot
}
