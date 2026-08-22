export const CONVERSATION_STATUS_CHANNEL = 'conversation:status'

export const FOLLOWUP_WINDOW_MS = 12_000

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

// ASR fires on coughs and room noise too. Count actual spoken characters so
// punctuation or a single letter padded with symbols cannot become an agent turn.
export function hasSpokenText(text: string): boolean {
  const spokenCharacters = text.match(/[\p{L}\p{N}]/gu)
  return (spokenCharacters?.length ?? 0) >= 2
}
