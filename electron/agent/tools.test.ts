import assert from 'node:assert/strict'
import test from 'node:test'
import { activeAgentToolNames, createAgentTools } from './tools'

test('registers eighteen tools with system tools and skills enabled', () => {
  const tools = createAgentTools({} as never, {
    systemToolsEnabled: true,
    skills: {} as never
  })

  assert.equal(Object.keys(tools).length, 18)
  assert.equal('get_current_datetime' in tools, false)
})

test('exposes read_chat only after search_chats completes', () => {
  const tools = { remember: {}, search_chats: {}, read_chat: {} } as never

  assert.deepEqual(activeAgentToolNames(tools), ['remember', 'search_chats'])
  assert.deepEqual(activeAgentToolNames(tools, { chatSearchCompleted: true }), [
    'remember',
    'search_chats',
    'read_chat'
  ])
})

test('registers search_web only when a configured provider is available', () => {
  const withoutProvider = createAgentTools({} as never, {
    webSearch: { getAvailableProviderIds: () => [] } as never
  })
  const withProvider = createAgentTools({} as never, {
    webSearch: { getAvailableProviderIds: () => ['firecrawl'] } as never
  })

  assert.equal('search_web' in withoutProvider, false)
  assert.equal('search_web' in withProvider, true)
})
