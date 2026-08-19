import { FOLLOWUP_WINDOW_MS } from '@/lib/agent'
import type { AgentService } from '../agent/service'
import type { LlmService } from '../llm/service'
import type { SettingsStore } from '../settings/store'
import type { SpeechService } from '../speech/service'
import type { WakeWordService } from '../wake-word/service'

type ConversationMode = 'idle' | 'agent' | 'followup'

type ConversationControllerOptions = {
  settings: SettingsStore
  llm: LlmService
  getAgent: () => AgentService | null
  getSpeech: () => SpeechService | null
  getWakeWord: () => WakeWordService | null
}

export class ConversationController {
  #mode: ConversationMode = 'idle'
  #followupTimer: NodeJS.Timeout | null = null
  #generation = 0

  constructor(private readonly options: ConversationControllerOptions) {}

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
      this.#clearFollowupTimer()
      if (!trimmed) {
        this.#idleAndResume()
        return
      }
      void this.#runAgent(trimmed)
      return
    }

    if (this.#mode === 'agent') return

    if (!trimmed || !this.#canRunAgent()) {
      this.#mode = 'idle'
      return
    }

    void this.#runAgent(trimmed)
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
    this.#mode = 'idle'
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
    this.#mode = 'agent'
    const generation = ++this.#generation
    const result = await agent.respond(text)
    if (generation !== this.#generation) return
    if (result === 'aborted') return
    if (result !== 'completed') {
      this.#idleAndResume()
      return
    }
    this.#startFollowup()
  }

  #startFollowup(): void {
    this.#mode = 'followup'
    this.#clearFollowupTimer()
    this.#followupTimer = setTimeout(() => {
      this.#followupTimer = null
      if (this.#mode !== 'followup') return
      this.options.getSpeech()?.cancelSession()
      this.#idleAndResume()
    }, FOLLOWUP_WINDOW_MS)
    void this.options.getSpeech()?.startSession()
  }

  #interrupt(): void {
    this.#generation += 1
    this.#clearFollowupTimer()
    this.#mode = 'idle'
    this.options.getAgent()?.abort()
  }

  #idleAndResume(): void {
    this.#mode = 'idle'
    this.#clearFollowupTimer()
    this.options.getWakeWord()?.resumeListening()
  }

  #clearFollowupTimer(): void {
    if (!this.#followupTimer) return
    clearTimeout(this.#followupTimer)
    this.#followupTimer = null
  }
}
