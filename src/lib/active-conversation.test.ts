import assert from 'node:assert/strict'
import test from 'node:test'
import type { ChatMessage } from './chats'
import { persistedTurnState } from './active-conversation'

function message(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: crypto.randomUUID(),
    chatId: 'chat',
    turnId: crypto.randomUUID(),
    role: 'user',
    content: '',
    createdAt: Date.now(),
    state: 'completed',
    ...overrides
  }
}

test('deduplicates a persisted turn even when agent and chat turn ids differ', () => {
  const messages = [
    message({ role: 'user', content: 'فردا هوا چطوره؟' }),
    message({ role: 'assistant', content: 'فردا آفتابیه.' })
  ]

  assert.deepEqual(
    persistedTurnState(messages, {
      userText: 'فردا هوا چطوره؟',
      assistantText: 'فردا آفتابیه.'
    }),
    { user: true, assistant: true }
  )
})

test('keeps a streaming assistant reply visible until it is persisted', () => {
  const messages = [
    message({ role: 'assistant', content: 'جواب قبلی' }),
    message({ role: 'user', content: 'سؤال تازه' })
  ]

  assert.deepEqual(
    persistedTurnState(messages, {
      userText: 'سؤال تازه',
      assistantText: 'جواب تازه'
    }),
    { user: true, assistant: false }
  )
})
