import type { BrowserWindow } from 'electron'
import {
  ASR_FINAL_HOLD_MS,
  ASR_MAX_UTTERANCE_MS,
  ASR_SAMPLE_RATE,
  INITIAL_SPEECH_STATUS,
  SPEECH_STATUS_CHANNEL,
  SPEECH_TRANSCRIPT_CHANNEL,
  type SpeechStatus,
  type SpeechTranscript
} from '../../shared/asr'
import type { ModelRegistry } from '../models/registry'
import type { SettingsStore } from '../settings/store'
import { LocalShenavaProvider, type SpeechProvider } from './provider'

type SpeechServiceOptions = {
  scriptPath: string
  models: ModelRegistry
  settings: SettingsStore
  getWindow: () => BrowserWindow | null
  getPreroll: () => ArrayBuffer
  onSessionEnd: () => void
}

export class SpeechService {
  #provider: SpeechProvider
  #status: SpeechStatus = { ...INITIAL_SPEECH_STATUS }
  #sessionId = 0
  #active = false
  #finalizing = false
  #maxTimer: NodeJS.Timeout | null = null
  #holdTimer: NodeJS.Timeout | null = null
  #loadTask: Promise<void> | null = null
  #pending: ArrayBuffer[] = []
  #pendingSamples = 0

  constructor(private readonly options: SpeechServiceOptions) {
    this.#provider = new LocalShenavaProvider({
      scriptPath: options.scriptPath,
      handlers: {
        onPartial: (text) => this.#onPartial(text),
        onEndpoint: (text) => this.#onEndpoint(text),
        onFinal: (text) => this.#onFinal(text),
        onError: (error) => this.#onProviderError(error)
      }
    })
  }

  getStatus(): SpeechStatus {
    return this.#status
  }

  isSessionActive(): boolean {
    return this.#active
  }

  async preload(): Promise<void> {
    const modelId = this.options.settings.get().activeModelId
    if (!this.options.models.isInstalled(modelId)) {
      this.#update({ phase: 'idle', modelId, ready: false, error: null, transcript: null })
      return
    }
    await this.#ensureLoaded(modelId)
  }

  async startSession(): Promise<void> {
    const modelId = this.options.settings.get().activeModelId
    if (!this.options.models.isInstalled(modelId)) {
      this.#update({
        phase: 'error',
        modelId,
        ready: false,
        error: 'اول مدل تشخیص گفتار را از تنظیمات دانلود کن.',
        transcript: null
      })
      return
    }

    this.#clearMaxTimer()
    this.#clearHoldTimer()
    this.#clearPending()
    this.#active = true
    this.#finalizing = false
    this.#sessionId += 1
    const sessionId = String(this.#sessionId)
    const preroll = this.options.getPreroll()
    this.#update({
      phase: 'loading',
      modelId,
      error: null,
      transcript: { sessionId, text: '', isFinal: false, updatedAt: Date.now() }
    })

    try {
      await this.#ensureLoaded(modelId)
      if (!this.#active || sessionId !== String(this.#sessionId)) return
      this.#provider.startUtterance()
      if (preroll.byteLength > 0) this.#provider.acceptAudio(preroll)
      this.#flushPending()
      this.#update({ phase: 'listening', ready: true, error: null })
      this.#maxTimer = setTimeout(() => this.finishSession(), ASR_MAX_UTTERANCE_MS)
    } catch (error) {
      this.#active = false
      this.#clearPending()
      this.#update({
        phase: 'error',
        ready: false,
        error: error instanceof Error ? error.message : 'بارگذاری مدل تشخیص گفتار ناموفق بود.'
      })
      this.options.onSessionEnd()
    }
  }

  processAudio(buffer: ArrayBuffer): void {
    if (!this.#active || this.#finalizing) return
    if (this.#status.phase !== 'listening') {
      this.#queueAudio(buffer)
      return
    }
    this.#provider.acceptAudio(buffer)
  }

  finishSession(): void {
    if (!this.#active || this.#finalizing) return
    this.#finalizing = true
    this.#clearMaxTimer()
    this.#update({ phase: 'finalizing' })
    this.#provider.stopUtterance()
  }

  cancelSession(): void {
    if (!this.#active && this.#status.phase !== 'error') return
    this.#active = false
    this.#finalizing = false
    this.#clearMaxTimer()
    this.#clearHoldTimer()
    this.#clearPending()
    try {
      this.#provider.stopUtterance()
    } catch {
      // Provider may already be gone.
    }
    this.#update({
      phase: this.#status.ready ? 'idle' : this.#status.phase === 'error' ? 'error' : 'idle',
      transcript: null
    })
  }

  dispose(): void {
    this.#active = false
    this.#clearMaxTimer()
    this.#clearHoldTimer()
    this.#clearPending()
    this.#provider.dispose()
    this.#update({ phase: 'idle', ready: false, modelId: null, transcript: null, error: null })
  }

  async #ensureLoaded(modelId: string): Promise<void> {
    if (this.#status.ready && this.#status.modelId === modelId && !this.#loadTask) return
    if (this.#loadTask) return this.#loadTask

    this.#loadTask = this.#provider
      .load({
        modelDir: this.options.models.getModelDir(modelId),
        endpoint: this.options.settings.get().endpoint
      })
      .then(() => {
        this.#update({ modelId, ready: true, error: this.#active ? this.#status.error : null })
      })
      .finally(() => {
        this.#loadTask = null
      })
    return this.#loadTask
  }

  #onPartial(text: string): void {
    if (!this.#active) return
    this.#emitTranscript({
      sessionId: String(this.#sessionId),
      text,
      isFinal: false,
      updatedAt: Date.now()
    })
  }

  #onEndpoint(text: string): void {
    if (!this.#active || this.#finalizing) return
    this.#emitTranscript({
      sessionId: String(this.#sessionId),
      text,
      isFinal: false,
      updatedAt: Date.now()
    })
    this.finishSession()
  }

  #onFinal(text: string): void {
    if (!this.#finalizing && !this.#active) return
    const transcript: SpeechTranscript = {
      sessionId: String(this.#sessionId),
      text,
      isFinal: true,
      updatedAt: Date.now()
    }
    this.#active = false
    this.#finalizing = false
    this.#clearMaxTimer()
    this.#emitTranscript(transcript)
    this.#update({ phase: 'idle', transcript })
    this.#holdTimer = setTimeout(() => {
      this.#holdTimer = null
      this.options.onSessionEnd()
    }, ASR_FINAL_HOLD_MS)
  }

  #onProviderError(error: string): void {
    this.#active = false
    this.#finalizing = false
    this.#clearMaxTimer()
    this.#clearHoldTimer()
    this.#update({ phase: 'error', ready: false, error })
    this.options.onSessionEnd()
  }

  #emitTranscript(transcript: SpeechTranscript): void {
    this.#status = { ...this.#status, transcript }
    const window = this.options.getWindow()
    if (window && !window.isDestroyed()) {
      window.webContents.send(SPEECH_TRANSCRIPT_CHANNEL, transcript)
      window.webContents.send(SPEECH_STATUS_CHANNEL, this.#status)
    }
  }

  #update(update: Partial<SpeechStatus>): void {
    this.#status = { ...this.#status, ...update }
    const window = this.options.getWindow()
    if (window && !window.isDestroyed()) {
      window.webContents.send(SPEECH_STATUS_CHANNEL, this.#status)
    }
  }

  #clearMaxTimer(): void {
    if (!this.#maxTimer) return
    clearTimeout(this.#maxTimer)
    this.#maxTimer = null
  }

  #clearHoldTimer(): void {
    if (!this.#holdTimer) return
    clearTimeout(this.#holdTimer)
    this.#holdTimer = null
  }

  #queueAudio(buffer: ArrayBuffer): void {
    const samples = buffer.byteLength / Float32Array.BYTES_PER_ELEMENT
    const maxSamples = ASR_SAMPLE_RATE * (ASR_MAX_UTTERANCE_MS / 1_000)
    if (this.#pendingSamples + samples > maxSamples) return
    this.#pending.push(buffer)
    this.#pendingSamples += samples
  }

  #flushPending(): void {
    for (const chunk of this.#pending) this.#provider.acceptAudio(chunk)
    this.#clearPending()
  }

  #clearPending(): void {
    this.#pending = []
    this.#pendingSamples = 0
  }
}
