export const CHATS_SNAPSHOT_CHANNEL = 'chats:snapshot'
export const CHAT_IDLE_TIMEOUT_MS = 30 * 60 * 1_000
export const CHAT_CONTEXT_MESSAGE_LIMIT = 20

export type ChatMessageRole = 'user' | 'assistant'
export type ChatMessageState = 'completed' | 'interrupted' | 'error'

export type ChatMessage = {
  id: string
  chatId: string
  turnId: string
  role: ChatMessageRole
  content: string
  createdAt: number
  state: ChatMessageState
}

export type ChatSummary = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  endedAt: number | null
  messageCount: number
  lastMessage: string
}

export type ChatDetail = ChatSummary & {
  messages: ChatMessage[]
}

export type ChatsSnapshot = {
  activeChatId: string | null
  activeChat: ChatDetail | null
  chats: ChatSummary[]
  totalCount: number
}

export type ChatSearchOptions = {
  query?: string
  from?: number
  to?: number
  limit?: number
}

export type ChatSearchHit = ChatSummary & {
  excerpt: string
}

export type ChatContextMessage = {
  role: ChatMessageRole
  content: string
}

export function normalizeChatSearchText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/gu, '')
    .replace(/[يى]/gu, 'ی')
    .replace(/ك/gu, 'ک')
    .replace(/ة/gu, 'ه')
    .replace(/[\u200C\u200D]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLocaleLowerCase('fa-IR')
}
