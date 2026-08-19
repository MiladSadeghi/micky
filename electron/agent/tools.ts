import { tool, type ToolSet } from 'ai'
import { z } from 'zod'
import type { SoulStore } from '../soul/store'

export function createAgentTools(soul: SoulStore): ToolSet {
  return {
    remember: tool({
      description:
        'Save a durable fact about the user or their world into long-term memory. Use for preferences, people, routines, and things they asked you to remember.',
      inputSchema: z.object({
        fact: z.string().min(1).max(500).describe('One concise fact in Persian or mixed language')
      }),
      execute: async ({ fact }) => {
        await soul.appendMemory(fact)
        return { saved: true }
      }
    }),
    recall: tool({
      description:
        'Search long-term memory. Pass a short query to filter, or an empty query to read recent memories.',
      inputSchema: z.object({
        query: z.string().max(200).describe('Substring to look for; empty to list recent notes')
      }),
      execute: async ({ query }) => {
        const memory = await soul.read('memory')
        const needle = query.trim()
        if (!needle) return { notes: capText(memory, 2_000) }
        const lines = memory
          .split('\n')
          .map((line) => line.trim())
          .filter(
            (line) => line.startsWith('- ') && line.toLowerCase().includes(needle.toLowerCase())
          )
        return {
          notes: lines.length > 0 ? lines.slice(0, 12).join('\n') : 'چیزی در حافظه پیدا نشد.'
        }
      }
    }),
    update_user_profile: tool({
      description:
        'Update a standing fact about the user in their profile. Use when they correct or add identity details.',
      inputSchema: z.object({
        field: z
          .enum(['name', 'addressForm', 'languageMix', 'city', 'work', 'focus', 'replyLength'])
          .describe('Which profile field to change'),
        value: z.string().min(1).max(200).describe('The new value')
      }),
      execute: async ({ field, value }) => {
        await soul.patchUser(field, value)
        return { updated: field }
      }
    }),
    get_current_datetime: tool({
      description: 'Get the current local date and time, including the Jalali calendar.',
      inputSchema: z.object({}),
      execute: async () => {
        const now = new Date()
        return {
          jalali: new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
            dateStyle: 'full',
            timeStyle: 'short'
          }).format(now),
          gregorian: new Intl.DateTimeFormat('en-CA', {
            dateStyle: 'medium',
            timeStyle: 'short'
          }).format(now),
          iso: now.toISOString()
        }
      }
    })
  }
}

function capText(value: string, max: number): string {
  const trimmed = value.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(-max).trimStart()}`
}
