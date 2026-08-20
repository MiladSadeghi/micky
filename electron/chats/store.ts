import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import {
  CHAT_CONTEXT_MESSAGE_LIMIT,
  CHAT_IDLE_TIMEOUT_MS,
  normalizeChatSearchText,
  type ChatContextMessage,
  type ChatDetail,
  type ChatMessage,
  type ChatMessageRole,
  type ChatMessageState,
  type ChatSearchHit,
  type ChatSearchOptions,
  type ChatsSnapshot,
  type ChatSummary
} from '@/lib/chats'

type ChatRow = {
  id: string
  title: string
  created_at: number
  updated_at: number
  ended_at: number | null
  message_count: number
  last_message: string | null
}

type MessageRow = {
  id: string
  chat_id: string
  turn_id: string
  role: ChatMessageRole
  content: string
  created_at: number
  state: ChatMessageState
}

type SearchRow = ChatRow & { excerpt: string | null }

export type AppendChatMessage = {
  turnId: string
  role: ChatMessageRole
  content: string
  createdAt?: number
  state?: ChatMessageState
}

export class ChatStore {
  #db: DatabaseSync
  #onChange?: () => void

  constructor(userDataPath: string, options: { onChange?: () => void } = {}) {
    const root = join(userDataPath, 'chats')
    mkdirSync(root, { recursive: true })
    this.#db = new DatabaseSync(join(root, 'history.sqlite'))
    this.#onChange = options.onChange
    this.#initialize()
  }

  close(): void {
    if (this.#db.isOpen) this.#db.close()
  }

  getSnapshot(): ChatsSnapshot {
    const activeChatId = this.getActiveChatId()
    return {
      activeChatId,
      activeChat: activeChatId ? this.getChat(activeChatId, 4) : null,
      chats: this.listChats(80),
      totalCount: this.countChats()
    }
  }

  getActiveChatId(): string | null {
    const row = this.#db
      .prepare("SELECT value FROM app_state WHERE key = 'active_chat_id'")
      .get() as { value?: string } | undefined
    if (!row?.value) return null
    const chat = this.#db
      .prepare('SELECT id FROM chats WHERE id = ? AND ended_at IS NULL')
      .get(row.value) as { id?: string } | undefined
    return chat?.id ?? null
  }

  ensureActiveChat(
    firstUserText: string,
    now = Date.now()
  ): {
    chatId: string
    created: boolean
  } {
    const activeId = this.getActiveChatId()
    if (activeId) {
      const row = this.#db.prepare('SELECT updated_at FROM chats WHERE id = ?').get(activeId) as
        { updated_at?: number } | undefined
      if (row?.updated_at != null && now - row.updated_at <= CHAT_IDLE_TIMEOUT_MS) {
        return { chatId: activeId, created: false }
      }
      this.endActiveChat(now, false)
    }

    const chatId = randomUUID()
    this.#db
      .prepare(
        'INSERT INTO chats (id, title, created_at, updated_at, ended_at) VALUES (?, ?, ?, ?, NULL)'
      )
      .run(chatId, makeChatTitle(firstUserText), now, now)
    this.#setActiveChatId(chatId)
    this.#emitChange()
    return { chatId, created: true }
  }

  resumeChat(chatId: string, now = Date.now()): ChatDetail | null {
    const existing = this.#db.prepare('SELECT id FROM chats WHERE id = ?').get(chatId) as
      { id?: string } | undefined
    if (!existing?.id) return null
    const current = this.getActiveChatId()
    if (current && current !== chatId) this.endActiveChat(now, false)
    this.#db
      .prepare('UPDATE chats SET ended_at = NULL, updated_at = ? WHERE id = ?')
      .run(now, chatId)
    this.#setActiveChatId(chatId)
    this.#emitChange()
    return this.getChat(chatId)
  }

  endActiveChat(now = Date.now(), emit = true): void {
    const activeId = this.getActiveChatId()
    if (activeId) {
      this.#db.prepare('UPDATE chats SET ended_at = ? WHERE id = ?').run(now, activeId)
    }
    this.#setActiveChatId(null)
    if (emit) this.#emitChange()
  }

  appendMessage(chatId: string, message: AppendChatMessage): ChatMessage {
    const content = message.content.trim()
    if (!content) throw new Error('Chat messages cannot be empty.')
    const createdAt = message.createdAt ?? Date.now()
    const record: ChatMessage = {
      id: randomUUID(),
      chatId,
      turnId: message.turnId,
      role: message.role,
      content,
      createdAt,
      state: message.state ?? 'completed'
    }
    this.#transaction(() => {
      this.#db
        .prepare(
          `INSERT INTO messages
            (id, chat_id, turn_id, role, content, normalized_content, created_at, state)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          record.id,
          record.chatId,
          record.turnId,
          record.role,
          record.content,
          normalizeChatSearchText(record.content),
          record.createdAt,
          record.state
        )
      this.#db
        .prepare('UPDATE chats SET updated_at = MAX(updated_at, ?) WHERE id = ?')
        .run(record.createdAt, chatId)
    })
    this.#emitChange()
    return record
  }

  getChat(chatId: string, messageLimit?: number): ChatDetail | null {
    const summary = this.#getSummary(chatId)
    if (!summary) return null
    const rows = messageLimit
      ? (this.#db
          .prepare(
            `SELECT id, chat_id, turn_id, role, content, created_at, state
             FROM (
               SELECT id, chat_id, turn_id, role, content, created_at, state
               FROM messages WHERE chat_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?
             ) ORDER BY created_at ASC`
          )
          .all(chatId, messageLimit) as unknown as MessageRow[])
      : (this.#db
          .prepare(
            `SELECT id, chat_id, turn_id, role, content, created_at, state
             FROM (
               SELECT id, chat_id, turn_id, role, content, created_at, state, rowid
               FROM messages WHERE chat_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 500
             ) ORDER BY created_at ASC, rowid ASC`
          )
          .all(chatId) as unknown as MessageRow[])
    return { ...summary, messages: rows.map(toChatMessage) }
  }

  getContext(chatId: string, limit = CHAT_CONTEXT_MESSAGE_LIMIT): ChatContextMessage[] {
    const rows = this.#db
      .prepare(
        `SELECT role, content FROM (
           SELECT role, content, created_at, rowid
           FROM messages
           WHERE chat_id = ? AND state != 'error'
           ORDER BY created_at DESC, rowid DESC LIMIT ?
         ) ORDER BY created_at ASC, rowid ASC`
      )
      .all(chatId, limit) as unknown as Array<{ role: ChatMessageRole; content: string }>
    return rows.map(({ role, content }) => ({ role, content }))
  }

  listChats(limit = 80): ChatSummary[] {
    const rows = this.#db
      .prepare(
        `SELECT c.id, c.title, c.created_at, c.updated_at, c.ended_at,
                COUNT(m.id) AS message_count,
                COALESCE((
                  SELECT content FROM messages latest
                  WHERE latest.chat_id = c.id
                  ORDER BY latest.created_at DESC, latest.rowid DESC LIMIT 1
                ), '') AS last_message
         FROM chats c
         LEFT JOIN messages m ON m.chat_id = c.id
         GROUP BY c.id
         ORDER BY c.updated_at DESC
         LIMIT ?`
      )
      .all(Math.max(1, Math.min(limit, 200))) as unknown as ChatRow[]
    return rows.map(toChatSummary)
  }

  countChats(): number {
    const row = this.#db.prepare('SELECT COUNT(*) AS count FROM chats').get() as
      { count?: number } | undefined
    return Number(row?.count ?? 0)
  }

  searchChats(options: ChatSearchOptions = {}): ChatSearchHit[] {
    const limit = Math.max(1, Math.min(options.limit ?? 8, 20))
    const query = toFtsQuery(options.query ?? '')
    if (!query) return this.#searchRecent(options, limit)

    const rows = this.#db
      .prepare(
        `SELECT c.id, c.title, c.created_at, c.updated_at, c.ended_at,
                (SELECT COUNT(*) FROM messages count_messages WHERE count_messages.chat_id = c.id)
                  AS message_count,
                COALESCE((
                  SELECT content FROM messages latest
                  WHERE latest.chat_id = c.id
                  ORDER BY latest.created_at DESC, latest.rowid DESC LIMIT 1
                ), '') AS last_message,
                m.content AS excerpt
         FROM messages_fts
         JOIN messages m ON m.rowid = messages_fts.rowid
         JOIN chats c ON c.id = m.chat_id
         WHERE messages_fts MATCH ?
           AND (? IS NULL OR m.created_at >= ?)
           AND (? IS NULL OR m.created_at < ?)
         ORDER BY bm25(messages_fts), m.created_at DESC
         LIMIT ?`
      )
      .all(
        query,
        nullableNumber(options.from),
        nullableNumber(options.from),
        nullableNumber(options.to),
        nullableNumber(options.to),
        limit * 5
      ) as unknown as SearchRow[]

    const seen = new Set<string>()
    const hits: ChatSearchHit[] = []
    for (const row of rows) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      hits.push({ ...toChatSummary(row), excerpt: row.excerpt?.trim() || row.last_message || '' })
      if (hits.length >= limit) break
    }
    return hits
  }

  deleteChat(chatId: string): boolean {
    const active = this.getActiveChatId() === chatId
    const result = this.#db.prepare('DELETE FROM chats WHERE id = ?').run(chatId)
    if (active) this.#setActiveChatId(null)
    if (result.changes > 0) this.#emitChange()
    return result.changes > 0
  }

  clear(): void {
    this.#transaction(() => {
      this.#db.exec('DELETE FROM messages; DELETE FROM chats; DELETE FROM app_state;')
    })
    this.#emitChange()
  }

  #initialize(): void {
    this.#db.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;

      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        ended_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        turn_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        normalized_content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('completed', 'interrupted', 'error'))
      );

      CREATE INDEX IF NOT EXISTS messages_chat_time
        ON messages(chat_id, created_at);

      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
        normalized_content,
        content='messages',
        content_rowid='rowid',
        tokenize='unicode61 remove_diacritics 2'
      );

      CREATE TRIGGER IF NOT EXISTS messages_fts_insert AFTER INSERT ON messages BEGIN
        INSERT INTO messages_fts(rowid, normalized_content)
        VALUES (new.rowid, new.normalized_content);
      END;

      CREATE TRIGGER IF NOT EXISTS messages_fts_delete AFTER DELETE ON messages BEGIN
        INSERT INTO messages_fts(messages_fts, rowid, normalized_content)
        VALUES ('delete', old.rowid, old.normalized_content);
      END;

      CREATE TRIGGER IF NOT EXISTS messages_fts_update AFTER UPDATE OF normalized_content ON messages BEGIN
        INSERT INTO messages_fts(messages_fts, rowid, normalized_content)
        VALUES ('delete', old.rowid, old.normalized_content);
        INSERT INTO messages_fts(rowid, normalized_content)
        VALUES (new.rowid, new.normalized_content);
      END;
    `)
  }

  #getSummary(chatId: string): ChatSummary | null {
    const row = this.#db
      .prepare(
        `SELECT c.id, c.title, c.created_at, c.updated_at, c.ended_at,
                COUNT(m.id) AS message_count,
                COALESCE((
                  SELECT content FROM messages latest
                  WHERE latest.chat_id = c.id
                  ORDER BY latest.created_at DESC, latest.rowid DESC LIMIT 1
                ), '') AS last_message
         FROM chats c
         LEFT JOIN messages m ON m.chat_id = c.id
         WHERE c.id = ?
         GROUP BY c.id`
      )
      .get(chatId) as unknown as ChatRow | undefined
    return row ? toChatSummary(row) : null
  }

  #searchRecent(options: ChatSearchOptions, limit: number): ChatSearchHit[] {
    const rows = this.#db
      .prepare(
        `SELECT c.id, c.title, c.created_at, c.updated_at, c.ended_at,
                COUNT(all_messages.id) AS message_count,
                COALESCE((
                  SELECT content FROM messages latest
                  WHERE latest.chat_id = c.id
                    AND (? IS NULL OR latest.created_at >= ?)
                    AND (? IS NULL OR latest.created_at < ?)
                  ORDER BY latest.created_at DESC, latest.rowid DESC LIMIT 1
                ), '') AS last_message
         FROM chats c
         LEFT JOIN messages all_messages ON all_messages.chat_id = c.id
         WHERE EXISTS (
           SELECT 1 FROM messages filtered
           WHERE filtered.chat_id = c.id
             AND (? IS NULL OR filtered.created_at >= ?)
             AND (? IS NULL OR filtered.created_at < ?)
         )
         GROUP BY c.id
         ORDER BY c.updated_at DESC
         LIMIT ?`
      )
      .all(
        nullableNumber(options.from),
        nullableNumber(options.from),
        nullableNumber(options.to),
        nullableNumber(options.to),
        nullableNumber(options.from),
        nullableNumber(options.from),
        nullableNumber(options.to),
        nullableNumber(options.to),
        limit
      ) as unknown as ChatRow[]
    return rows.map((row) => ({ ...toChatSummary(row), excerpt: row.last_message ?? '' }))
  }

  #setActiveChatId(chatId: string | null): void {
    if (!chatId) {
      this.#db.prepare("DELETE FROM app_state WHERE key = 'active_chat_id'").run()
      return
    }
    this.#db
      .prepare(
        `INSERT INTO app_state (key, value) VALUES ('active_chat_id', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .run(chatId)
  }

  #transaction(run: () => void): void {
    this.#db.exec('BEGIN IMMEDIATE')
    try {
      run()
      this.#db.exec('COMMIT')
    } catch (error) {
      this.#db.exec('ROLLBACK')
      throw error
    }
  }

  #emitChange(): void {
    this.#onChange?.()
  }
}

function toChatSummary(row: ChatRow): ChatSummary {
  return {
    id: row.id,
    title: row.title,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    endedAt: row.ended_at == null ? null : Number(row.ended_at),
    messageCount: Number(row.message_count),
    lastMessage: row.last_message ?? ''
  }
}

function toChatMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    chatId: row.chat_id,
    turnId: row.turn_id,
    role: row.role,
    content: row.content,
    createdAt: Number(row.created_at),
    state: row.state
  }
}

function makeChatTitle(text: string): string {
  const normalized = text.trim().replace(/\s+/gu, ' ')
  if (normalized.length <= 44) return normalized
  return `${normalized.slice(0, 43).trimEnd()}…`
}

function toFtsQuery(value: string): string {
  const tokens = normalizeChatSearchText(value).match(/[\p{L}\p{N}]+/gu) ?? []
  return tokens
    .slice(0, 10)
    .map((token) => `"${token.replaceAll('"', '""')}"*`)
    .join(' AND ')
}

function nullableNumber(value: number | undefined): SQLInputValue {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
