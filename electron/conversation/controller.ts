import type { BrowserWindow } from 'electron'
import {
  FOLLOWUP_WINDOW_MS,
  INITIAL_CONVERSATION_STATUS,
  CONVERSATION_STATUS_CHANNEL,
  type ConversationStatus
} from '@/lib/conversation'
import type { AgentService } from '../agent/service'
import type { LlmService } from '../llm/service'
import type { SettingsStore } from '../settings/store'
import type { SpeechService } from '../speech/service'
import type { WakeWordService } from '../wake-word/service'

type ConversationMode = ConversationStatus['mode']

type ConversationControllerOptions = {
  settings: SettingsStore
  llm: LlmService
  getAgent: () => AgentService | null
  getSpeech: () => SpeechService | null
  getWakeWord: () => WakeWordService | null
  getWindow: () => BrowserWindow | null
}

function hasSpokenText(text: string): boolean {
  const trimmed = text.trim()
  return trimmed.length >= 2 && /\p{L}/u.test(trimmed)
}

export class ConversationController {
  #mode: ConversationMode = 'idle'
  #status: ConversationStatus = { ...INITIAL_CONVERSATION_STATUS }
  #followupTimer: NodeJS.Timeout | null = null
  #followupDeadline: number | null = null
  #generation = 0

  constructor(private readonly options: ConversationControllerOptions) {}

  getStatus(): ConversationStatus {
    return this.#status
  }

  onWakeActivated(): void {
    this.#interrupt()
  }

  onWakeResume(): void {
    this.#interrupt()
  }

  sendText(text: string): void {
    const trimmed = text.trim()
    if (!trimmed) return
    void this.#runAgent(trimmed)
  }

  onFinalTranscript(text: string): void {
    const trimmed = text.trim()
    if (this.#mode === 'followup') {
      if (!trimmed) {
        void this.#keepFollowupListening()
        return
      }
      this.#clearFollowupTimer()
      this.#followupDeadline = null
      void this.#runAgent(trimmed)
      return
    }

    if (this.#mode === 'agent') return

    if (!trimmed || !this.#canRunAgent()) {
      this.#setStatus({ mode: 'idle', followupUntil: null, followupHeard: false })
      return
    }

    void this.#runAgent(trimmed)
  }

  onPartialTranscript(text: string): void {
    if (this.#mode !== 'followup' || !hasSpokenText(text)) return
    this.#clearFollowupTimer()
    if (this.#status.followupHeard) return
    this.#setStatus({
      mode: 'followup',
      followupUntil: null,
      followupHeard: true
    })
  }

  onSpeechSessionEnd(): void {
    if (this.#mode === 'agent') return
    if (this.#mode === 'followup') {
      if (this.options.getSpeech()?.getStatus().phase === 'error') this.#idleAndResume()
      return
    }
    this.options.getWakeWord()?.resumeListening()
  }

  dispose(): void {
    this.#generation += 1
    this.#clearFollowupTimer()
    this.#followupDeadline = null
    this.#setStatus({ mode: 'idle', followupUntil: null, followupHeard: false })
  }

  #canRunAgent(): boolean {
    return this.options.settings.get().onboardingCompleted && this.options.llm.isConfigured()
  }

  async #runAgent(text: string): Promise<void> {
    const agent = this.options.getAgent()
    if (!agent) {
      this.#idleAndResume()
      return
    }

    this.#clearFollowupTimer()
    this.#followupDeadline = null
    const generation = ++this.#generation
    this.#setStatus({ mode: 'agent', followupUntil: null, followupHeard: false })
    const result = await agent.respond(text)
    if (generation !== this.#generation) return
    if (result === 'aborted') return
    if (result !== 'completed') {
      this.#idleAndResume()
      return
    }
    await this.#startFollowup(generation)
  }

  async #startFollowup(generation: number): Promise<void> {
    this.#followupDeadline = Date.now() + FOLLOWUP_WINDOW_MS
    this.#setStatus({
      mode: 'followup',
      followupUntil: this.#followupDeadline,
      followupHeard: false
    })
    await this.options.getSpeech()?.startSession({ preroll: false })
    if (generation !== this.#generation || this.#mode !== 'followup') return
    this.#armFollowupTimer()
  }

  async #keepFollowupListening(): Promise<void> {
    if (this.#mode !== 'followup') return
    const remaining = (this.#followupDeadline ?? 0) - Date.now()
    if (remaining <= 150) {
      this.#idleAndResume()
      return
    }

    const generation = this.#generation
    this.#setStatus({
      mode: 'followup',
      followupUntil: this.#followupDeadline,
      followupHeard: false
    })
    await this.options.getSpeech()?.startSession({ preroll: false })
    if (generation !== this.#generation || this.#mode !== 'followup') return
    if (!this.#followupTimer) this.#armFollowupTimer()
  }

  #armFollowupTimer(): void {
    const deadline = this.#followupDeadline
    if (!deadline) return
    const remaining = deadline - Date.now()
    if (remaining <= 0) {
      this.#idleAndResume()
      return
    }

    this.#clearFollowupTimer()
    this.#setStatus({
      mode: 'followup',
      followupUntil: deadline,
      followupHeard: this.#status.followupHeard
    })
    if (this.#status.followupHeard) return
    this.#followupTimer = setTimeout(() => {
      this.#followupTimer = null
      if (this.#mode !== 'followup' || this.#status.followupHeard) return
      this.options.getSpeech()?.cancelSession()
      this.#idleAndResume()
    }, remaining)
  }

  #interrupt(): void {
    this.#generation += 1
    this.#clearFollowupTimer()
    this.#followupDeadline = null
    this.#setStatus({ mode: 'idle', followupUntil: null, followupHeard: false })
    this.options.getAgent()?.abort()
  }

  #idleAndResume(): void {
    this.#clearFollowupTimer()
    this.#followupDeadline = null
    this.#setStatus({ mode: 'idle', followupUntil: null, followupHeard: false })
    this.options.getWakeWord()?.resumeListening()
  }

  #setStatus(status: ConversationStatus): void {
    this.#mode = status.mode
    this.#status = status
    const window = this.options.getWindow()
    if (window && !window.isDestroyed()) {
      window.webContents.send(CONVERSATION_STATUS_CHANNEL, this.#status)
    }
  }

  #clearFollowupTimer(): void {
    if (!this.#followupTimer) return
    clearTimeout(this.#followupTimer)
    this.#followupTimer = null
  }
}
