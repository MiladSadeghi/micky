import { useEffect, useState } from 'react'
import type { ChatsSnapshot } from '@/lib/chats'

export function useChats(): ChatsSnapshot | null {
  const [snapshot, setSnapshot] = useState<ChatsSnapshot | null>(null)

  useEffect(() => {
    let active = true
    void window.api.chats
      .getSnapshot()
      .then((next) => {
        if (active) setSnapshot(next)
      })
      .catch(() => {
        if (active) setSnapshot(null)
      })
    const unsubscribe = window.api.chats.onSnapshotChange((next) => {
      if (active) setSnapshot(next)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return snapshot
}
