import type { BrowserWindow } from 'electron'
import { isStepCount, ToolLoopAgent, type ModelMessage } from 'ai'
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
import { createAgentTools } from './tools'

type AgentServiceOptions = {
  settings: SettingsStore
  llm: LlmService
  soul: SoulStore
  getWindow: () => BrowserWindow | null
}

export class AgentService {
  #status: AgentStatus = { ...INITIAL_AGENT_STATUS }
  #history: ModelMessage[] = []
  #abort: AbortController | null = null
  #turnSeq = 0

  constructor(private readonly options: AgentServiceOptions) {}

  getStatus(): AgentStatus {
    return this.#status
  }

  abort(): void {
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

  async respond(userText: string): Promise<'completed' | 'aborted' | 'skipped'> {
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
      error: null
    }
    this.#setTurn(turn)

    if (!this.options.llm.isConfigured()) {
      this.#fail(turn, 'برای جواب‌دادن، کلید OpenRouter و مدل زبانی را از تنظیمات کامل کن.')
      return 'skipped'
    }

    try {
      const files = await this.options.soul.readAll()
      const settings = this.options.settings.get()
      const tools = createAgentTools(this.options.soul)
      const agent = new ToolLoopAgent({
        model: this.options.llm.getProvider().getModel(settings.llm.modelId),
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
            toolName: toolCall.toolName
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
          replyText: reply
        })
        this.#emitDelta({ turnId, delta, text: reply })
      }

      if (abort.signal.aborted) return 'aborted'

      const responseMessages = await result.responseMessages
      this.#history = trimHistory([...this.#history, userMessage, ...responseMessages])
      this.#setTurn({
        ...this.#currentTurn(turnId, turn),
        phase: 'idle',
        toolName: null,
        replyText: reply,
        error: null
      })
      this.#update({ phase: 'idle', error: null })
      return 'completed'
    } catch (error) {
      if (abort.signal.aborted) return 'aborted'
      const message =
        error instanceof Error && error.message.trim() ? error.message : 'جواب‌دادن ناموفق بود.'
      this.#fail(this.#currentTurn(turnId, turn), message)
      return 'skipped'
    } finally {
      if (this.#abort === abort) this.#abort = null
    }
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
    this.#setTurn({ ...turn, phase: 'error', error, toolName: null })
    this.#update({ phase: 'error', error })
  }

  #update(update: Partial<AgentStatus>): void {
    this.#status = { ...this.#status, ...update }
    this.#emitStatus()
  }

  #emitStatus(): void {
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
