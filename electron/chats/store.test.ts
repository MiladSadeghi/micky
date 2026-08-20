import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { CHAT_IDLE_TIMEOUT_MS, normalizeChatSearchText } from '@/lib/chats'
import { ChatStore } from './store'

async function createStore(t: test.TestContext): Promise<{ root: string; store: ChatStore }> {
  const root = await mkdtemp(join(tmpdir(), 'micky-chats-'))
  const store = new ChatStore(root)
  t.after(async () => {
    store.close()
    await rm(root, { recursive: true, force: true })
  })
  return { root, store }
}

test('persists chats and restores their recent context', async (t) => {
  const { root, store } = await createStore(t)
  const startedAt = Date.UTC(2026, 7, 20, 8)
  const { chatId } = store.ensureActiveChat('برای سفر شیراز برنامه بچین', startedAt)
  store.appendMessage(chatId, {
    turnId: 'turn-1',
    role: 'user',
    content: 'برای سفر شیراز برنامه بچین',
    createdAt: startedAt
  })
  store.appendMessage(chatId, {
    turnId: 'turn-1',
    role: 'assistant',
    content: 'چند روز وقت داری؟',
    createdAt: startedAt + 1
  })

  assert.deepEqual(store.getContext(chatId), [
    { role: 'user', content: 'برای سفر شیراز برنامه بچین' },
    { role: 'assistant', content: 'چند روز وقت داری؟' }
  ])
  store.close()

  const reopened = new ChatStore(root)
  t.after(() => reopened.close())
  assert.equal(reopened.getActiveChatId(), chatId)
  assert.equal(reopened.getChat(chatId)?.messages.length, 2)
  assert.equal(reopened.getSnapshot().totalCount, 1)
})

test('starts a new chat after the inactivity boundary', async (t) => {
  const { store } = await createStore(t)
  const now = Date.UTC(2026, 7, 20, 8)
  const first = store.ensureActiveChat('سلام', now)
  store.appendMessage(first.chatId, {
    turnId: 'turn-1',
    role: 'user',
    content: 'سلام',
    createdAt: now
  })

  assert.equal(store.ensureActiveChat('ادامه بده', now + CHAT_IDLE_TIMEOUT_MS).chatId, first.chatId)
  const next = store.ensureActiveChat('موضوع تازه', now + CHAT_IDLE_TIMEOUT_MS + 1)
  assert.notEqual(next.chatId, first.chatId)
  assert.ok(store.getChat(first.chatId)?.endedAt)
})

test('normalizes Persian variants and searches within date boundaries', async (t) => {
  const { store } = await createStore(t)
  const yesterday = Date.UTC(2026, 7, 19, 12)
  const { chatId } = store.ensureActiveChat('درباره کتاب حرف بزنیم', yesterday)
  store.appendMessage(chatId, {
    turnId: 'turn-1',
    role: 'user',
    content: 'درباره کتاب‌های طراحی صحبت کردیم',
    createdAt: yesterday
  })

  assert.equal(normalizeChatSearchText('كتاب‌هاي'), 'کتاب های')
  const hits = store.searchChats({
    query: 'كتاب',
    from: Date.UTC(2026, 7, 19),
    to: Date.UTC(2026, 7, 20)
  })
  assert.equal(hits.length, 1)
  assert.equal(hits[0]?.id, chatId)
  assert.equal(store.searchChats({ query: 'کتاب', from: Date.UTC(2026, 7, 20) }).length, 0)
})

test('deleting a chat removes it from transcript search', async (t) => {
  const { store } = await createStore(t)
  const { chatId } = store.ensureActiveChat('جلسه محصول')
  store.appendMessage(chatId, {
    turnId: 'turn-1',
    role: 'user',
    content: 'درباره نسخه بعدی میکی گفتیم'
  })
  assert.equal(store.searchChats({ query: 'نسخه' }).length, 1)
  assert.equal(store.deleteChat(chatId), true)
  assert.equal(store.searchChats({ query: 'نسخه' }).length, 0)
  assert.equal(store.getActiveChatId(), null)
})
