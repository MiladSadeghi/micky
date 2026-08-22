import type { BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import { interpretApproval } from '@/lib/approval'
import {
  CONFIRM_WINDOW_MS,
  FOLLOWUP_WINDOW_MS,
  INITIAL_CONVERSATION_STATUS,
  CONVERSATION_STATUS_CHANNEL,
  hasSpokenText,
  type ConversationStatus
} from '@/lib/conversation'
import type { AgentService } from '../agent/service'
import type { LlmService } from '../llm/service'
import type { SettingsStore } from '../settings/store'
import type { SpeechService } from '../speech/service'
import type { TtsService } from '../tts/service'
import type { WakeWordService } from '../wake-word/service'
import type { ChatStore } from '../chats/store'

type ConversationMode = ConversationStatus['mode']

type ConversationControllerOptions = {
  settings: SettingsStore
  llm: LlmService
  getAgent: () => AgentService | null
  getSpeech: () => SpeechService | null
  getTts: () => TtsService | null
  getWakeWord: () => WakeWordService | null
  getChats?: () => ChatStore | null
  getWindow: () => BrowserWindow | null
  onStatusChange?: (status: ConversationStatus) => void
  shouldUseVoice?: () => boolean
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

  onApprovalNeeded(): void {
    if (this.#mode !== 'agent' && this.#mode !== 'confirm') return
    void this.#startConfirm()
  }

  resolveApproval(approved: boolean): void {
    this.#settleApproval(approved)
  }

  sendText(text: string): void {
    const trimmed = text.trim()
    if (!trimmed) return
    if (this.#mode === 'confirm') {
      this.onFinalTranscript(trimmed)
      return
    }
    void this.#runAgent(trimmed)
  }

  onFinalTranscript(text: string): void {
    const trimmed = text.trim()
    if (this.#mode === 'confirm') {
      if (!trimmed) {
        void this.#keepConfirmListening()
        return
      }
      const approval = interpretApproval(trimmed)
      if (approval === 'unknown') {
        void this.#keepConfirmListening()
        return
      }
      this.#settleApproval(approval === 'yes')
      return
    }

    if (this.#mode === 'followup') {
      if (!hasSpokenText(trimmed)) {
        void this.#keepFollowupListening()
        return
      }
      this.#clearFollowupTimer()
      this.#followupDeadline = null
      void this.#runAgent(trimmed)
      return
    }

    if (this.#mode === 'agent') return

    if (!hasSpokenText(trimmed) || !this.#canRunAgent()) {
      this.#setStatus({ mode: 'idle', followupUntil: null, followupHeard: false })
      return
    }

    void this.#runAgent(trimmed)
  }

  onPartialTranscript(text: string): void {
    if ((this.#mode !== 'followup' && this.#mode !== 'confirm') || !hasSpokenText(text)) return
    this.#clearFollowupTimer()
    if (this.#status.followupHeard) return
    this.#setStatus({
      mode: this.#mode,
      followupUntil: null,
      followupHeard: true
    })
  }

  holdListenWindow(): void {
    if (this.#mode !== 'followup' && this.#mode !== 'confirm') return
    this.#clearFollowupTimer()
    if (this.#status.followupHeard) return
    this.#setStatus({
      mode: this.#mode,
      followupUntil: null,
      followupHeard: true
    })
  }

  onSpeechSessionEnd(): void {
    if (this.#mode === 'agent') return
    if (this.#mode === 'confirm') {
      if (this.options.getSpeech()?.getStatus().phase === 'error') this.#settleApproval(false)
      return
    }
    if (this.#mode === 'followup') {
      if (this.options.getSpeech()?.getStatus().phase === 'error') this.#idleAndResume()
      return
    }
    this.options.getWakeWord()?.resumeListening()
  }

  startFresh(): void {
    this.#generation += 1
    this.#clearFollowupTimer()
    this.#followupDeadline = null
    this.#setStatus({ mode: 'idle', followupUntil: null, followupHeard: false })
    this.options.getAgent()?.reset()
    this.options.getChats?.()?.endActiveChat()
    this.options.getSpeech()?.cancelSession()
    this.options.getTts()?.stop()
    this.options.getWakeWord()?.resumeListening()
  }

  resumeChat(chatId: string): boolean {
    const chats = this.options.getChats?.()
    const agent = this.options.getAgent()
    if (!chats || !agent) return false
    const detail = chats.resumeChat(chatId)
    if (!detail) return false

    this.#generation += 1
    this.#clearFollowupTimer()
    this.#followupDeadline = null
    this.#setStatus({ mode: 'idle', followupUntil: null, followupHeard: false })
    this.options.getSpeech()?.cancelSession()
    this.options.getTts()?.stop()
    agent.replaceHistory(chats.getContext(chatId))
    this.options.getWakeWord()?.resumeListening()
    return true
  }

  deleteChat(chatId: string): boolean {
    const chats = this.options.getChats?.()
    if (!chats) return false
    const wasActive = chats.getActiveChatId() === chatId
    if (wasActive) {
      this.#generation += 1
      this.#clearFollowupTimer()
      this.#followupDeadline = null
      this.#setStatus({ mode: 'idle', followupUntil: null, followupHeard: false })
      this.options.getSpeech()?.cancelSession()
      this.options.getTts()?.stop()
      this.options.getAgent()?.reset()
      this.options.getWakeWord()?.resumeListening()
    }
    return chats.deleteChat(chatId)
  }

  clearChats(): void {
    this.startFresh()
    this.options.getChats?.()?.clear()
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

  #shouldUseVoice(): boolean {
    return this.options.shouldUseVoice?.() !== false
  }

  async #runAgent(text: string): Promise<void> {
    const agent = this.options.getAgent()
    if (!agent) {
      this.#idleAndResume()
      return
    }

    let chats =
      this.options.settings.get().chatHistoryEnabled !== false ? this.options.getChats?.() : null
    const turnId = randomUUID()
    let chatId: string | null = null
    if (chats) {
      try {
        const active = chats.ensureActiveChat(text)
        chatId = active.chatId
        agent.replaceHistory(chats.getContext(chatId))
        chats.appendMessage(chatId, { turnId, role: 'user', content: text })
      } catch (error) {
        console.warn('[chats] Could not persist the user turn.', error)
        chats = null
        chatId = null
      }
    }

    this.#clearFollowupTimer()
    this.#followupDeadline = null
    const generation = ++this.#generation
    const usesMainSurface = this.#shouldUseVoice()
    const speechEnabled =
      usesMainSurface && this.options.getTts()?.getSnapshot().configured === true
    this.#setStatus({ mode: 'agent', followupUntil: null, followupHeard: false })
    const result = await agent.respond(text, {
      responseSurface: usesMainSurface ? 'main' : 'flyover',
      speechEnabled,
      ...(chatId ? { sessionId: chatId } : {})
    })
    if (generation !== this.#generation) return
    if (result === 'aborted') return
    if (result !== 'completed' && result !== 'ended') {
      const failure = agent.getStatus().turn?.error
      if (chatId && failure?.trim()) {
        try {
          chats?.appendMessage(chatId, {
            turnId,
            role: 'assistant',
            content: failure,
            state: 'error'
          })
        } catch (error) {
          console.warn('[chats] Could not persist the failed turn.', error)
        }
      }
      this.#idleAndResume()
      return
    }
    const reply = agent.getStatus().turn?.replyText ?? ''
    if (chatId && reply.trim()) {
      try {
        chats?.appendMessage(chatId, { turnId, role: 'assistant', content: reply })
      } catch (error) {
        console.warn('[chats] Could not persist the assistant turn.', error)
      }
    }
    if (reply.trim() && speechEnabled) await this.options.getTts()?.speak(reply)
    if (generation !== this.#generation) return
    if (result === 'ended') {
      try {
        chats?.endActiveChat()
      } catch (error) {
        console.warn('[chats] Could not close the active chat.', error)
      }
      this.#idleAndResume()
      return
    }
    await this.#startFollowup(generation)
  }

  async #startConfirm(): Promise<void> {
    this.#clearFollowupTimer()
    this.#followupDeadline = null
    this.#setStatus({
      mode: 'confirm',
      followupUntil: null,
      followupHeard: false
    })
    const generation = this.#generation
    const purpose = this.options.getAgent()?.getStatus().turn?.confirmText
    if (this.#shouldUseVoice()) {
      await this.options.getTts()?.speak(spokenApprovalPrompt(purpose))
    }
    if (generation !== this.#generation || this.#mode !== 'confirm') return

    this.#followupDeadline = Date.now() + CONFIRM_WINDOW_MS
    this.#setStatus({
      mode: 'confirm',
      followupUntil: this.#followupDeadline,
      followupHeard: false
    })
    await this.options.getSpeech()?.startSession({ preroll: false })
    if (generation !== this.#generation || this.#mode !== 'confirm') return
    this.#armConfirmTimer()
  }

  async #keepConfirmListening(): Promise<void> {
    if (this.#mode !== 'confirm') return
    const remaining = (this.#followupDeadline ?? 0) - Date.now()
    if (remaining <= 150) {
      this.#settleApproval(false)
      return
    }
    const generation = this.#generation
    this.#setStatus({
      mode: 'confirm',
      followupUntil: this.#followupDeadline,
      followupHeard: false
    })
    await this.options.getSpeech()?.startSession({ preroll: false })
    if (generation !== this.#generation || this.#mode !== 'confirm') return
    if (!this.#followupTimer) this.#armConfirmTimer()
  }

  #armConfirmTimer(): void {
    const deadline = this.#followupDeadline
    if (!deadline) return
    const remaining = deadline - Date.now()
    if (remaining <= 0) {
      this.#settleApproval(false)
      return
    }
    this.#clearFollowupTimer()
    this.#setStatus({
      mode: 'confirm',
      followupUntil: deadline,
      followupHeard: this.#status.followupHeard
    })
    if (this.#status.followupHeard) return
    this.#followupTimer = setTimeout(() => {
      this.#followupTimer = null
      if (this.#mode !== 'confirm' || this.#status.followupHeard) return
      this.#settleApproval(false)
    }, remaining)
  }

  #settleApproval(approved: boolean): void {
    if (this.#mode !== 'confirm') return
    this.#clearFollowupTimer()
    this.#followupDeadline = null
    this.#setStatus({ mode: 'agent', followupUntil: null, followupHeard: false })
    this.options.getTts()?.stop()
    this.options.getSpeech()?.cancelSession()
    this.options.getAgent()?.resolveApproval(approved)
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
    this.options.getTts()?.stop()
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
    this.options.onStatusChange?.(status)
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

function spokenApprovalPrompt(purpose?: string | null): string {
  const trimmed = purpose?.trim().replace(/[.!…،؛]+$/u, '')
  if (!trimmed) return 'این کار رو انجام بدم؟'
  if (/[؟?]$/u.test(trimmed)) return trimmed
  return `${trimmed}؛ انجامش بدم؟`
}
