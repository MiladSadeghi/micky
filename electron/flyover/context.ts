import { CHAT_IDLE_TIMEOUT_MS, type ChatDetail } from '@/lib/chats'

export type FlyoverConversationPreview = {
  title: string
  text: string
}

export function getFlyoverConversationPreview(
  chat: ChatDetail | null,
  now = Date.now()
): FlyoverConversationPreview | null {
  if (!chat || chat.endedAt !== null || now - chat.updatedAt > CHAT_IDLE_TIMEOUT_MS) return null

  let text = ''
  for (let index = chat.messages.length - 1; index >= 0; index -= 1) {
    const message = chat.messages[index]
    if (message?.state !== 'completed' || !message.content.trim()) continue
    text = message.content.trim()
    break
  }
  if (!text) return null

  return {
    title: `ادامهٔ گفتگو · ${chat.title}`,
    text: text.slice(0, 700)
  }
}
