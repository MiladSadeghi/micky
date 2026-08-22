import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { activeAgentToolNames, createAgentTools } from './tools'

type ExecutableTool = {
  execute: (input: Record<string, unknown>) => Promise<Record<string, unknown>>
}

function executable(tool: unknown): ExecutableTool {
  return tool as ExecutableTool
}

test('registers eighteen tools with system tools and skills enabled', () => {
  const tools = createAgentTools({} as never, {
    systemToolsEnabled: true,
    skills: {} as never
  })

  assert.equal(Object.keys(tools).length, 18)
  assert.equal('get_current_datetime' in tools, false)
})

test('keeps screen viewing separate from file and command access', async () => {
  const tools = createAgentTools({} as never, {
    systemToolsEnabled: false,
    screenAccessEnabled: false,
    screenCaptureAllowed: true
  })

  assert.equal('look_at_screen' in tools, true)
  assert.equal('read_file' in tools, false)
  assert.deepEqual(await executable(tools.look_at_screen).execute({ question: 'چه می‌بینی؟' }), {
    observed: false,
    message: 'دیدن صفحه از تنظیمات «ابزارها و دسترسی‌ها» خاموش است.'
  })
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

test('edits explicitly requested personal context without approval', async () => {
  let written: { file: string; content: string } | null = null
  let approvalRequests = 0
  const tools = createAgentTools(
    {
      write: async (file: string, content: string) => {
        written = { file, content }
      }
    } as never,
    {
      requestApproval: async () => {
        approvalRequests += 1
        return false
      }
    }
  )

  const result = await executable(tools.edit_personal_context).execute({
    file: 'soul',
    content: '# Updated soul'
  })

  assert.deepEqual(result, { updated: true, file: 'SOUL.md' })
  assert.deepEqual(written, { file: 'soul', content: '# Updated soul' })
  assert.equal(approvalRequests, 0)
})

test('writes ordinary text directly but asks before suspicious formats', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'micky-tool-write-'))
  t.after(() => rm(directory, { recursive: true, force: true }))

  const approvals: string[] = []
  const tools = createAgentTools({} as never, {
    systemToolsEnabled: true,
    requestApproval: async ({ command }) => {
      approvals.push(command)
      return false
    }
  })

  const markdownPath = join(directory, 'notes.md')
  const markdownResult = await executable(tools.write_file).execute({
    path: markdownPath,
    content: '# Notes\n',
    mode: 'create',
    purpose: 'یادداشت را ذخیره می‌کنم.'
  })
  assert.equal(markdownResult.written, true)
  assert.equal(await readFile(markdownPath, 'utf8'), '# Notes\n')

  const scriptPath = join(directory, 'install.sh')
  const scriptResult = await executable(tools.write_file).execute({
    path: scriptPath,
    content: '#!/bin/sh\n',
    mode: 'create',
    purpose: 'اسکریپت را می‌سازم.'
  })
  assert.deepEqual(scriptResult, {
    written: false,
    approved: false,
    message: 'کاربر اجازه نداد.'
  })
  assert.equal(approvals.length, 1)
  assert.equal(approvals[0]?.endsWith('/install.sh'), true)
})
