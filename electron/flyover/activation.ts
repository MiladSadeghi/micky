import type { WakeWordActivation } from '@/lib/wake-word'
import type { ConversationMode } from '@/lib/conversation'

export type AssistantShortcutAction =
  'start-session' | 'stop-session' | 'reveal-ongoing' | 'hide-mirror'

export function shouldShowWakeFlyover(
  activation: WakeWordActivation,
  mainWindowFocused: boolean
): boolean {
  return activation.source === 'wake-word' && !mainWindowFocused
}

export function assistantShortcutAction(input: {
  flyoverActive: boolean
  flyoverMirroring: boolean
  conversationMode: ConversationMode
  speechActive: boolean
  dictationActive: boolean
}): AssistantShortcutAction {
  if (input.flyoverActive) {
    return input.flyoverMirroring ? 'hide-mirror' : 'stop-session'
  }
  if (!input.dictationActive && (input.conversationMode !== 'idle' || input.speechActive)) {
    return 'reveal-ongoing'
  }
  return 'start-session'
}
