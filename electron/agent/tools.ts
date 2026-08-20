import { tool, type ToolSet } from 'ai'
import { z } from 'zod'
import type { SoulStore } from '../soul/store'
import type { ChatStore } from '../chats/store'
import { openUserTarget, runUserCommand, type ApprovalRequest } from '../system/exec'
import {
  listUserDirectory,
  MAX_WRITE_BYTES,
  readUserFile,
  searchInUserFiles,
  searchUserFiles,
  writeUserFile
} from '../system/fs-tools'
import { PathDeniedError, resolveSafePath } from '../system/paths'
import { fetchCleanWebpage } from '../system/web-fetch'

export type AgentToolHooks = {
  chats?: ChatStore
  onEndConversation?: () => void
  systemToolsEnabled?: boolean
  requestApproval?: (request: ApprovalRequest) => Promise<boolean>
  abortSignal?: AbortSignal
  screenCaptureAllowed?: boolean
  lookAtScreen?: (question: string) => Promise<string>
}

export function createAgentTools(soul: SoulStore, hooks: AgentToolHooks = {}): ToolSet {
  const tools: ToolSet = {
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
    search_chats: tool({
      description:
        'Search the user’s locally stored past conversations. Use only when they ask what was discussed before or want to find an earlier chat. Use ISO timestamps for date boundaries and keep the query short.',
      inputSchema: z.object({
        query: z.string().max(200).optional().describe('Words to find; omit for date-only recall'),
        from: z.string().max(40).optional().describe('Inclusive ISO date-time boundary'),
        to: z.string().max(40).optional().describe('Exclusive ISO date-time boundary'),
        limit: z.number().int().min(1).max(8).optional().describe('Maximum chats to return')
      }),
      execute: async ({ query, from, to, limit }) => {
        if (!hooks.chats) return { chats: [], message: 'تاریخچه گفتگو در دسترس نیست.' }
        const matches = hooks.chats.searchChats({
          query,
          from: parseDateBoundary(from),
          to: parseDateBoundary(to),
          limit: limit ?? 5
        })
        return {
          chats: matches.map((match) => ({
            id: match.id,
            title: match.title,
            date: new Date(match.updatedAt).toISOString(),
            excerpt: capText(match.excerpt, 500)
          }))
        }
      }
    }),
    read_chat: tool({
      description:
        'Read selected turns from one past chat after search_chats found it. Never read an entire long archive when a short excerpt is enough.',
      inputSchema: z.object({
        chatId: z.string().uuid().describe('Chat ID returned by search_chats'),
        maxMessages: z.number().int().min(2).max(20).optional()
      }),
      execute: async ({ chatId, maxMessages }) => {
        const chat = hooks.chats?.getChat(chatId)
        if (!chat) return { found: false, message: 'گفتگو پیدا نشد.' }
        const messages = chat.messages.slice(-(maxMessages ?? 12))
        return {
          found: true,
          title: chat.title,
          updatedAt: new Date(chat.updatedAt).toISOString(),
          messages: messages.map((message) => ({
            speaker: message.role === 'user' ? 'user' : 'Micky',
            text: capText(message.content, 700),
            at: new Date(message.createdAt).toISOString()
          }))
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
    edit_personal_context: tool({
      description:
        "Replace one of Micky's private Markdown context files. Use only when the user explicitly asks to edit Micky's personality, profile document, or memory document. Preserve unrelated information. Prefer remember and update_user_profile for ordinary facts.",
      inputSchema: z.object({
        file: z.enum(['soul', 'user', 'memory']).describe('The context document to replace'),
        content: z
          .string()
          .min(1)
          .max(20_000)
          .describe('The complete replacement Markdown in English'),
        purpose: z
          .string()
          .min(1)
          .max(160)
          .describe('One short Persian sentence explaining the change to the user')
      }),
      execute: async ({ file, content, purpose }) => {
        if (!hooks.requestApproval) {
          return { updated: false, message: 'ویرایش تنظیمات شخصی در این جلسه در دسترس نیست.' }
        }
        const approved = await hooks.requestApproval({
          purpose,
          command: `${file.toUpperCase()}.md`,
          toolName: 'edit_personal_context',
          detail: `${file.toUpperCase()}.md`
        })
        if (!approved) return { updated: false, approved: false, message: 'کاربر اجازه نداد.' }
        await soul.write(file, content)
        return { updated: true, file: `${file.toUpperCase()}.md` }
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
    }),
    end_conversation: tool({
      description:
        'End this conversation and stop listening for a follow-up. Use only when the user is clearly wrapping up the whole chat, such as goodbye, I am done, that is all, or see you later. Do not use for thanks or okay if they might continue.',
      inputSchema: z.object({}),
      execute: async () => {
        hooks.onEndConversation?.()
        return { ended: true }
      }
    })
  }

  if (!hooks.systemToolsEnabled) return tools

  tools.look_at_screen = tool({
    description:
      'Look at the active display and explain what is visible. Use when the current user directly asks what you see, asks you to look at something visible now, or asks about their screen.',
    inputSchema: z.object({
      question: z.string().max(500).describe('What the user wants understood from the screen')
    }),
    execute: async ({ question }) => {
      if (!hooks.screenCaptureAllowed) {
        return {
          observed: false,
          message: 'از کاربر بخواه صریح بگوید به صفحه نگاه کن یا صفحه را توضیح بده.'
        }
      }
      if (!hooks.lookAtScreen) return { observed: false, message: 'دیدن صفحه در دسترس نیست.' }
      return { observed: true, observations: await hooks.lookAtScreen(question) }
    }
  })

  tools.fetch_webpage = tool({
    description:
      'Fetch a public web page and return its clean readable text plus title and source metadata. Use for a URL the user gives you and for facts that may have changed. This tool performs only an anonymous GET: it cannot access logins, local network pages, downloads, or private addresses.',
    inputSchema: z.object({
      url: z.string().min(1).max(2_000).describe('A complete public http(s) URL')
    }),
    execute: async ({ url }) =>
      guardAction(
        async () => fetchCleanWebpage(url, { abortSignal: hooks.abortSignal }),
        'دریافت صفحه ناموفق بود.'
      )
  })

  tools.read_file = tool({
    description:
      'Read a UTF-8 text file on this computer. Use for notes, configs, documents, CSV, Markdown, and source code in approved user locations. Never read secrets such as keys, browser data, shell history, or .env files.',
    inputSchema: z.object({
      path: z.string().min(1).max(500).describe('Absolute path or ~/path')
    }),
    execute: async ({ path }) =>
      guardPath(async () => {
        const result = await readUserFile(path)
        return { path: result.path, content: result.content, truncated: result.truncated }
      })
  })

  tools.write_file = tool({
    description:
      'Create, replace, or append to a UTF-8 text file such as TXT, Markdown, CSV, JSON, or source code. Use only when the user asks you to save or change a file. Read an existing file before overwriting it, preserve unrelated content, and prefer create for new files. Protected paths and binary files are blocked. Every write requires user approval.',
    inputSchema: z.object({
      path: z.string().min(1).max(500).describe('Absolute path or ~/path for the destination file'),
      content: z
        .string()
        .refine((value) => !value.includes('\0'), {
          message: 'Content must be plain UTF-8 text without null bytes.'
        })
        .refine((value) => Buffer.byteLength(value, 'utf8') <= MAX_WRITE_BYTES, {
          message: 'Content must be no larger than 512 KB as UTF-8.'
        })
        .describe('The exact UTF-8 text to write, up to 512 KB'),
      mode: z
        .enum(['create', 'overwrite', 'append'])
        .describe('create refuses an existing file; overwrite replaces it; append adds to it'),
      purpose: z
        .string()
        .min(1)
        .max(160)
        .describe('One short Persian sentence explaining the file change to the user')
    }),
    execute: async ({ path, content, mode, purpose }) =>
      guardAction(async () => {
        if (!hooks.requestApproval) {
          return { written: false, message: 'نوشتن فایل در این جلسه در دسترس نیست.' }
        }
        const resolvedPath = await resolveSafePath(path)
        const approved = await hooks.requestApproval({
          purpose,
          command: resolvedPath,
          toolName: 'write_file',
          detail: `${mode}: ${resolvedPath}`
        })
        if (!approved) return { written: false, approved: false, message: 'کاربر اجازه نداد.' }
        const result = await writeUserFile(resolvedPath, content, mode)
        return { written: true, ...result }
      }, 'نوشتن فایل ناموفق بود.')
  })

  tools.list_directory = tool({
    description: 'List files and folders in an approved directory on this computer.',
    inputSchema: z.object({
      path: z.string().min(1).max(500).describe('Directory path, absolute or ~/path')
    }),
    execute: async ({ path }) =>
      guardPath(async () => {
        const result = await listUserDirectory(path)
        return { path: result.path, entries: result.entries, truncated: result.truncated }
      })
  })

  tools.search_files = tool({
    description:
      'Find files and folders by name. Prefer a narrow directory. Skips .git, node_modules, and Library when searching from home.',
    inputSchema: z.object({
      query: z.string().min(1).max(120).describe('Substring of the file or folder name'),
      directory: z
        .string()
        .max(500)
        .optional()
        .describe('Directory to search; defaults to the user home')
    }),
    execute: async ({ query, directory }) =>
      guardPath(async () => {
        const result = await searchUserFiles(query, directory?.trim() || '~')
        return { directory: result.directory, matches: result.matches, truncated: result.truncated }
      })
  })

  tools.search_in_files = tool({
    description: 'Search the contents of text files for a literal string.',
    inputSchema: z.object({
      query: z.string().min(1).max(120).describe('Literal text to find'),
      directory: z
        .string()
        .max(500)
        .optional()
        .describe('Directory to search; defaults to the user home')
    }),
    execute: async ({ query, directory }) =>
      guardPath(async () => {
        const result = await searchInUserFiles(query, directory?.trim() || '~')
        return { directory: result.directory, hits: result.hits, truncated: result.truncated }
      })
  })

  tools.open_app = tool({
    description:
      'Open an app, file, or web URL using the operating system. Pass an app name, a file path, or an https URL. Do not pass shell flags or commands.',
    inputSchema: z.object({
      target: z.string().min(1).max(300).describe('App name, file path, or http(s) URL')
    }),
    execute: async ({ target }) => openUserTarget(target)
  })

  tools.run_command = tool({
    description:
      'Run a terminal command on this computer. Prefer the dedicated file, web, search, and open tools when they fit. Safe read-only commands run immediately. Anything that writes, deletes, installs, or uses the network needs the user to say yes. Never use sudo. Fill purpose with one short spoken Persian sentence describing what you are about to do, without the raw command.',
    inputSchema: z.object({
      command: z.string().min(1).max(1_000).describe('The exact command to run'),
      purpose: z
        .string()
        .min(1)
        .max(160)
        .describe('One short Persian sentence for the user, not the command itself')
    }),
    execute: async ({ command, purpose }) => {
      if (!hooks.requestApproval) {
        return { ran: false, message: 'اجرای دستور در این جلسه در دسترس نیست.' }
      }
      return runUserCommand(command, purpose, {
        requestApproval: hooks.requestApproval,
        abortSignal: hooks.abortSignal
      })
    }
  })

  return tools
}

async function guardPath<T>(run: () => Promise<T>): Promise<T | { error: string }> {
  return guardAction(run, 'خواندن فایل ناموفق بود.')
}

async function guardAction<T>(
  run: () => Promise<T>,
  fallback: string
): Promise<T | { error: string }> {
  try {
    return await run()
  } catch (error) {
    if (error instanceof PathDeniedError) return { error: error.message }
    const message = error instanceof Error && error.message.trim() ? error.message : fallback
    return { error: message }
  }
}

function capText(value: string, max: number): string {
  const trimmed = value.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(-max).trimStart()}`
}

function parseDateBoundary(value?: string): number | undefined {
  if (!value?.trim()) return undefined
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : undefined
}
