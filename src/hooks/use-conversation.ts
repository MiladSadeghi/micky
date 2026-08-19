import { useEffect, useState } from 'react'
import type { ConversationStatus } from '@/lib/conversation'

export function useConversation(): ConversationStatus | null {
  const [status, setStatus] = useState<ConversationStatus | null>(null)

  useEffect(() => {
    let active = true
    void window.api.conversation.getStatus().then((next) => {
      if (active) setStatus(next)
    })
    const unsubscribe = window.api.conversation.onStatusChange((next) => {
      if (active) setStatus(next)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return status
}
