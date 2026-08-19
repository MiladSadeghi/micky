import { useEffect, useRef } from 'react'
import type { ConversationStatus } from '@/lib/conversation'
import { playListenChime, playTurnDoneChime } from '@/lib/wake-chime'

export function useTurnCues(conversation: ConversationStatus | null): void {
  const previous = useRef<ConversationStatus | null>(null)

  useEffect(() => {
    const prev = previous.current
    previous.current = conversation
    if (!conversation) return

    if (prev?.mode === 'agent' && conversation.mode === 'followup') {
      playTurnDoneChime()
    }
    if (
      conversation.mode === 'followup' &&
      prev?.followupUntil == null &&
      conversation.followupUntil != null
    ) {
      playListenChime()
    }
  }, [conversation])
}
