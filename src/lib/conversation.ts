export const CONVERSATION_STATUS_CHANNEL = 'conversation:status'

export const FOLLOWUP_WINDOW_MS = 12_000

export type ConversationMode = 'idle' | 'agent' | 'followup'

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
