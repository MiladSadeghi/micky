export const CONVERSATION_STATUS_CHANNEL = 'conversation:status'

export const FOLLOWUP_WINDOW_MS = 12_000
export const CONFIRM_WINDOW_MS = 20_000

export type ConversationMode = 'idle' | 'agent' | 'confirm' | 'followup'

export type ConversationStatus = {
  mode: ConversationMode
  followupUntil: number | null
  followupHeard: boolean
}

export const INITIAL_CONVERSATION_STATUS: ConversationStatus = {
  mode: 'idle',
  followupUntil: null,
  followupHeard: false
}

// ASR fires on coughs and room noise too; a blip should not count as talking.
export function hasSpokenText(text: string): boolean {
  const trimmed = text.trim()
  return trimmed.length >= 2 && /\p{L}/u.test(trimmed)
}
