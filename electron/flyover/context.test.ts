import assert from 'node:assert/strict'
import test from 'node:test'
import { CHAT_IDLE_TIMEOUT_MS, type ChatDetail } from '@/lib/chats'
import { getFlyoverConversationPreview } from './context'

const NOW = 2_000_000

function chat(overrides: Partial<ChatDetail> = {}): ChatDetail {
  return {
    id: 'chat-1',
    title: 'برنامه سفر شیراز',
    createdAt: NOW - 2_000,
    updatedAt: NOW - 1_000,
    endedAt: null,
    messageCount: 2,
    lastMessage: 'برای سه روز این برنامه خوبه.',
    messages: [
      {
        id: 'message-1',
        chatId: 'chat-1',
        turnId: 'turn-1',
        role: 'user',
        content: 'برای شیراز برنامه بچین',
        createdAt: NOW - 2_000,
        state: 'completed'
      },
      {
        id: 'message-2',
        chatId: 'chat-1',
        turnId: 'turn-1',
        role: 'assistant',
        content: 'برای سه روز این برنامه خوبه.',
        createdAt: NOW - 1_000,
        state: 'completed'
      }
    ],
    ...overrides
  }
}

test('previews the latest completed message from an active conversation', () => {
  assert.deepEqual(getFlyoverConversationPreview(chat(), NOW), {
    title: 'ادامهٔ گفتگو · برنامه سفر شیراز',
    text: 'برای سه روز این برنامه خوبه.'
  })
})

test('does not preview stale or ended conversations', () => {
  assert.equal(
    getFlyoverConversationPreview(chat({ updatedAt: NOW - CHAT_IDLE_TIMEOUT_MS - 1 }), NOW),
    null
  )
  assert.equal(getFlyoverConversationPreview(chat({ endedAt: NOW - 1 }), NOW), null)
})
