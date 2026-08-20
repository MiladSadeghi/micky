import { useEffect, useState } from 'react'
import type { SkillsSnapshot } from '@/lib/skills'

export function useSkills(): SkillsSnapshot | null {
  const [snapshot, setSnapshot] = useState<SkillsSnapshot | null>(null)

  useEffect(() => {
    let active = true
    void window.api.skills.getSnapshot().then((next) => {
      if (active) setSnapshot(next)
    })
    const unsubscribe = window.api.skills.onSnapshotChange((next) => {
      if (active) setSnapshot(next)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return snapshot
}
