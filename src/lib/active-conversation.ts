import type { ChatMessage } from '@/lib/chats'

export function persistedTurnState(
  messages: ChatMessage[],
  turn: { userText: string; assistantText: string }
): { user: boolean; assistant: boolean } {
  let latestUserIndex = -1
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role !== 'user') continue
    latestUserIndex = index
    break
  }
  const user =
    latestUserIndex >= 0 && messages[latestUserIndex]?.content.trim() === turn.userText.trim()
  const assistant = Boolean(
    user &&
    turn.assistantText.trim() &&
    messages
      .slice(latestUserIndex + 1)
      .some(
        (message) =>
          message.role === 'assistant' && message.content.trim() === turn.assistantText.trim()
      )
  )
  return { user, assistant }
}
