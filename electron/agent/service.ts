import type { BrowserWindow } from 'electron'
import { isStepCount, ToolLoopAgent, type ModelMessage } from 'ai'
import type { ChatContextMessage } from '@/lib/chats'
import {
  AGENT_DELTA_CHANNEL,
  AGENT_HISTORY_LIMIT,
  AGENT_MAX_STEPS,
  AGENT_STATUS_CHANNEL,
  INITIAL_AGENT_STATUS,
  type AgentDelta,
  type AgentStatus,
  type AgentTurn
} from '@/lib/agent'
import type { LlmService } from '../llm/service'
import type { SettingsStore } from '../settings/store'
import { buildSystemPrompt } from '../soul/prompt'
import type { SoulStore } from '../soul/store'
import type { ApprovalRequest } from '../system/exec'
import { createAgentTools } from './tools'
import { hasExplicitScreenIntent } from '../vision/intent'
import type { ChatStore } from '../chats/store'

type AgentServiceOptions = {
  settings: SettingsStore
  llm: LlmService
  soul: SoulStore
  chats?: ChatStore
  getWindow: () => BrowserWindow | null
  onApprovalNeeded?: () => void
  lookAtScreen?: (question: string, abortSignal?: AbortSignal) => Promise<string>
  onStatusChange?: (status: AgentStatus) => void
}

export class AgentService {
  #status: AgentStatus = { ...INITIAL_AGENT_STATUS }
  #history: ModelMessage[] = []
  #abort: AbortController | null = null
  #turnSeq = 0
  #pendingApproval: ((approved: boolean) => void) | null = null

  constructor(private readonly options: AgentServiceOptions) {}

  getStatus(): AgentStatus {
    return this.#status
  }

  abort(): void {
    this.resolveApproval(false)
    this.#abort?.abort()
    this.#abort = null
    if (this.#status.phase !== 'idle' && this.#status.phase !== 'error') {
      this.#update({ phase: 'idle' })
    }
  }

  reset(): AgentStatus {
    this.abort()
    this.#history = []
    this.#status = { ...INITIAL_AGENT_STATUS }
    this.#emitStatus()
    return this.#status
  }

  replaceHistory(messages: ChatContextMessage[]): AgentStatus {
    this.abort()
    this.#history = messages.map(({ role, content }) => ({ role, content }))
    this.#status = { ...INITIAL_AGENT_STATUS }
    this.#emitStatus()
    return this.#status
  }

  resolveApproval(approved: boolean): void {
    const pending = this.#pendingApproval
    this.#pendingApproval = null
    if (!pending) return
    const turn = this.#status.turn
    if (turn && turn.phase === 'confirm') {
      this.#setTurn({
        ...turn,
        phase: 'tool',
        confirmText: null,
        confirmDetail: null
      })
    }
    pending(approved)
  }

  async respond(userText: string): Promise<'completed' | 'ended' | 'aborted' | 'skipped'> {
    const text = userText.trim()
    if (!text) return 'skipped'

    this.abort()
    const abort = new AbortController()
    this.#abort = abort
    const turnId = String(++this.#turnSeq)
    const turn: AgentTurn = {
      turnId,
      userText: text,
      replyText: '',
      phase: 'thinking',
      toolName: null,
      confirmText: null,
      confirmDetail: null,
      error: null
    }
    this.#setTurn(turn)

    if (!this.options.llm.isConfigured()) {
      this.#fail(turn, 'برای جواب‌دادن، سرویس و مدل زبانی را از تنظیمات کامل کن.')
      return 'skipped'
    }

    try {
      const files = await this.options.soul.readAll()
      const settings = this.options.settings.get()
      let endRequested = false
      let screenCaptureConsumed = false
      const screenCaptureAllowed = hasExplicitScreenIntent(text)
      const tools = createAgentTools(this.options.soul, {
        chats: this.options.chats,
        systemToolsEnabled: settings.systemToolsEnabled !== false,
        abortSignal: abort.signal,
        onEndConversation: () => {
          endRequested = true
        },
        requestApproval: (request) => this.#requestApproval(turnId, turn, request, abort.signal),
        screenCaptureAllowed,
        lookAtScreen: async (question) => {
          if (!screenCaptureAllowed) return 'درخواست صریحی برای دیدن صفحه وجود ندارد.'
          if (screenCaptureConsumed) return 'در هر نوبت فقط یک بار می‌توانم صفحه را ببینم.'
          screenCaptureConsumed = true
          return this.options.lookAtScreen?.(question, abort.signal) ?? 'دیدن صفحه در دسترس نیست.'
        }
      })
      const agent = new ToolLoopAgent({
        model: this.options.llm.getModel(),
        instructions: buildSystemPrompt(files),
        tools,
        temperature: settings.llm.temperature,
        stopWhen: isStepCount(AGENT_MAX_STEPS)
      })

      const userMessage: ModelMessage = { role: 'user', content: text }
      const result = await agent.stream({
        messages: [...this.#history, userMessage],
        abortSignal: abort.signal,
        onToolExecutionStart: ({ toolCall }) => {
          if (abort.signal.aborted || this.#status.turn?.turnId !== turnId) return
          this.#setTurn({
            ...this.#currentTurn(turnId, turn),
            phase: 'tool',
            toolName: toolCall.toolName,
            confirmText: null,
            confirmDetail: null
          })
        }
      })

      let reply = ''
      for await (const delta of result.textStream) {
        if (abort.signal.aborted) return 'aborted'
        if (!delta) continue
        reply += delta
        this.#setTurn({
          ...this.#currentTurn(turnId, turn),
          phase: 'speaking',
          toolName: null,
          confirmText: null,
          confirmDetail: null,
          replyText: reply
        })
        this.#emitDelta({ turnId, delta, text: reply })
      }

      if (abort.signal.aborted) return 'aborted'

      const responseMessages = await result.responseMessages
      if (endRequested) {
        this.#history = []
      } else {
        this.#history = trimHistory([...this.#history, userMessage, ...responseMessages])
      }
      this.#setTurn({
        ...this.#currentTurn(turnId, turn),
        phase: 'idle',
        toolName: null,
        confirmText: null,
        confirmDetail: null,
        replyText: reply,
        error: null
      })
      this.#update({ phase: 'idle', error: null })
      return endRequested ? 'ended' : 'completed'
    } catch (error) {
      if (abort.signal.aborted) return 'aborted'
      const message =
        error instanceof Error && error.message.trim() ? error.message : 'جواب‌دادن ناموفق بود.'
      this.#fail(this.#currentTurn(turnId, turn), message)
      return 'skipped'
    } finally {
      this.resolveApproval(false)
      if (this.#abort === abort) this.#abort = null
    }
  }

  #requestApproval(
    turnId: string,
    fallback: AgentTurn,
    request: ApprovalRequest,
    abortSignal: AbortSignal
  ): Promise<boolean> {
    if (abortSignal.aborted) return Promise.resolve(false)
    this.resolveApproval(false)
    return new Promise((resolve) => {
      this.#pendingApproval = resolve
      this.#setTurn({
        ...this.#currentTurn(turnId, fallback),
        phase: 'confirm',
        toolName: request.toolName ?? 'run_command',
        confirmText: request.purpose,
        confirmDetail: request.detail ?? request.command,
        error: null
      })
      this.options.onApprovalNeeded?.()
      const onAbort = (): void => {
        abortSignal.removeEventListener('abort', onAbort)
        this.resolveApproval(false)
      }
      abortSignal.addEventListener('abort', onAbort, { once: true })
    })
  }

  #currentTurn(turnId: string, fallback: AgentTurn): AgentTurn {
    return this.#status.turn?.turnId === turnId ? this.#status.turn : fallback
  }

  #setTurn(turn: AgentTurn): void {
    this.#status = {
      phase: turn.phase,
      turn,
      error: turn.error
    }
    this.#emitStatus()
  }

  #fail(turn: AgentTurn, error: string): void {
    this.#setTurn({
      ...turn,
      phase: 'error',
      error,
      toolName: null,
      confirmText: null,
      confirmDetail: null
    })
    this.#update({ phase: 'error', error })
  }

  #update(update: Partial<AgentStatus>): void {
    this.#status = { ...this.#status, ...update }
    this.#emitStatus()
  }

  #emitStatus(): void {
    this.options.onStatusChange?.(this.#status)
    const window = this.options.getWindow()
    if (window && !window.isDestroyed()) {
      window.webContents.send(AGENT_STATUS_CHANNEL, this.#status)
    }
  }

  #emitDelta(delta: AgentDelta): void {
    const window = this.options.getWindow()
    if (window && !window.isDestroyed()) {
      window.webContents.send(AGENT_DELTA_CHANNEL, delta)
    }
  }
}

function trimHistory(messages: ModelMessage[]): ModelMessage[] {
  if (messages.length <= AGENT_HISTORY_LIMIT) return messages
  let sliced = messages.slice(-AGENT_HISTORY_LIMIT)
  while (sliced.length > 0 && sliced[0]?.role === 'tool') {
    sliced = sliced.slice(1)
  }
  return sliced
}
