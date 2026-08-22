import type { WakeWordActivation } from '@/lib/wake-word'
import type { ConversationMode } from '@/lib/conversation'

export type AssistantShortcutAction =
  'start-session' | 'stop-session' | 'reveal-ongoing' | 'hide-ongoing' | 'hide-mirror'

export type MainWindowFocusAction = 'none' | 'hide' | 'detach-assistant' | 'cancel-compose'

export function shouldShowWakeFlyover(
  activation: WakeWordActivation,
  mainWindowFocused: boolean
): boolean {
  return activation.source === 'wake-word' && !mainWindowFocused
}

export function assistantShortcutAction(input: {
  flyoverActive: boolean
  flyoverVisible: boolean
  flyoverMirroring: boolean
  conversationMode: ConversationMode
  speechActive: boolean
  dictationActive: boolean
}): AssistantShortcutAction {
  if (input.flyoverActive) {
    if (!input.flyoverVisible) return 'reveal-ongoing'
    if (input.flyoverMirroring) return 'hide-mirror'
    if (input.conversationMode !== 'idle') {
      return 'hide-ongoing'
    }
    return 'stop-session'
  }
  if (!input.dictationActive && (input.conversationMode !== 'idle' || input.speechActive)) {
    return 'reveal-ongoing'
  }
  return 'start-session'
}

export function mainWindowFocusAction(input: {
  flyoverVisible: boolean
  assistantActive: boolean
  assistantComposing: boolean
}): MainWindowFocusAction {
  if (!input.flyoverVisible) return 'none'
  if (!input.assistantActive) return 'hide'
  return input.assistantComposing ? 'cancel-compose' : 'detach-assistant'
}
