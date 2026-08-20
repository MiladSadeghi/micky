import type { BrowserWindow } from 'electron'
import {
  copyPlaybackAudio,
  GEMINI_TTS_VOICES,
  INITIAL_TTS_STATUS,
  TTS_PLAYBACK_CHANNEL,
  TTS_SNAPSHOT_CHANNEL,
  TTS_STATUS_CHANNEL,
  TTS_STOP_CHANNEL,
  type TtsProviderId,
  type TtsSnapshot,
  type TtsStatus
} from '@/lib/tts'
import type { SecretStore } from '../llm/secrets'
import type { SettingsStore } from '../settings/store'
import { ElevenLabsTtsProvider } from './elevenlabs'
import { GeminiTtsProvider } from './gemini'
import type { TtsProvider } from './provider'

type TtsServiceOptions = {
  settings: SettingsStore
  secrets: SecretStore
  getWindow: () => BrowserWindow | null
}

type PendingPlayback = {
  id: string
  resolve: (result: SpeakResult) => void
  timeout: NodeJS.Timeout
}

export type SpeakResult = 'completed' | 'aborted' | 'failed' | 'skipped'

export class TtsService {
  #providers: Record<TtsProviderId, TtsProvider>
  #status: TtsStatus = { ...INITIAL_TTS_STATUS }
  #snapshot: TtsSnapshot
  #abort: AbortController | null = null
  #pending: PendingPlayback | null = null
  #requestSeq = 0
  #elevenLabsVoices: TtsSnapshot['elevenLabsVoices'] = []

  constructor(private readonly options: TtsServiceOptions) {
    this.#providers = {
      gemini: new GeminiTtsProvider(() => options.secrets.getTtsApiKey('gemini')),
      elevenlabs: new ElevenLabsTtsProvider(() => options.secrets.getTtsApiKey('elevenlabs'))
    }
    this.#snapshot = this.#buildSnapshot()
  }

  getStatus(): TtsStatus {
    return this.#status
  }

  getSnapshot(): TtsSnapshot {
    return this.#snapshot
  }

  async refresh(): Promise<TtsSnapshot> {
    let error: string | null = null
    if (this.options.secrets.hasTtsApiKey('elevenlabs')) {
      try {
        this.#elevenLabsVoices = await this.#providers.elevenlabs.listVoices!()
      } catch (cause) {
        error = errorMessage(cause, 'فهرست صداهای ElevenLabs دریافت نشد.')
      }
    } else {
      this.#elevenLabsVoices = []
    }
    this.#snapshot = this.#buildSnapshot(error)
    this.#emitSnapshot()
    return this.#snapshot
  }

  async setEnabled(enabled: boolean): Promise<TtsSnapshot> {
    if (!enabled) this.stop()
    await this.options.settings.update({ tts: { enabled } })
    return this.#refreshLocal()
  }

  async setProvider(providerId: TtsProviderId): Promise<TtsSnapshot> {
    this.stop()
    await this.options.settings.update({ tts: { providerId } })
    return this.#refreshLocal()
  }

  async setVoice(providerId: TtsProviderId, voiceId: string): Promise<TtsSnapshot> {
    const trimmed = voiceId.trim().slice(0, 128)
    if (!trimmed) throw new Error('شناسه صدا خالی است.')
    if (providerId === 'gemini' && !GEMINI_TTS_VOICES.some((voice) => voice.id === trimmed)) {
      throw new Error('صدای Gemini معتبر نیست.')
    }
    await this.options.settings.update({
      tts: providerId === 'gemini' ? { geminiVoice: trimmed } : { elevenLabsVoiceId: trimmed }
    })
    return this.#refreshLocal()
  }

  async setApiKey(providerId: TtsProviderId, value: string): Promise<TtsSnapshot> {
    await this.options.secrets.setTtsApiKey(providerId, value)
    return this.refresh()
  }

  async clearApiKey(providerId: TtsProviderId): Promise<TtsSnapshot> {
    this.stop()
    await this.options.secrets.clearTtsApiKey(providerId)
    return this.refresh()
  }

  async speak(text: string): Promise<SpeakResult> {
    const trimmed = text.trim()
    const settings = this.options.settings.get().tts
    if (!trimmed || !settings.enabled || !this.#isConfigured(settings.providerId)) return 'skipped'

    this.stop()
    const abort = new AbortController()
    this.#abort = abort
    this.#setStatus({ phase: 'synthesizing', error: null })
    try {
      const audio = await this.#providers[settings.providerId].synthesize(
        trimmed.slice(0, 10_000),
        settings,
        abort.signal
      )
      if (abort.signal.aborted || this.#abort !== abort) return 'aborted'
      const window = this.options.getWindow()
      if (!window || window.isDestroyed()) {
        this.#abort = null
        this.#setStatus({ phase: 'error', error: 'پنجره برنامه برای پخش صدا آماده نیست.' })
        return 'failed'
      }

      const id = String(++this.#requestSeq)
      const audioBytes = copyPlaybackAudio(audio.bytes)
      this.#setStatus({ phase: 'playing', error: null })
      return await new Promise<SpeakResult>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.#pending?.id !== id) return
          this.#pending = null
          this.#abort = null
          const activeWindow = this.options.getWindow()
          if (activeWindow && !activeWindow.isDestroyed()) {
            activeWindow.webContents.send(TTS_STOP_CHANNEL, id)
          }
          this.#setStatus({ phase: 'error', error: 'پخش صدا بیش از حد طول کشید.' })
          resolve('failed')
        }, 120_000)
        this.#pending = { id, resolve, timeout }
        window.webContents.send(TTS_PLAYBACK_CHANNEL, {
          id,
          mimeType: audio.mimeType,
          audio: audioBytes
        })
      })
    } catch (cause) {
      if (abort.signal.aborted) return 'aborted'
      this.#abort = null
      this.#setStatus({ phase: 'error', error: errorMessage(cause, 'ساخت صدا ناموفق بود.') })
      return 'failed'
    }
  }

  finishPlayback(id: string, error?: string): void {
    const pending = this.#pending
    if (!pending || pending.id !== id) return
    clearTimeout(pending.timeout)
    this.#pending = null
    this.#abort = null
    if (error) {
      this.#setStatus({ phase: 'error', error: error.slice(0, 500) })
      pending.resolve('failed')
    } else {
      this.#setStatus({ phase: 'idle', error: null })
      pending.resolve('completed')
    }
  }

  stop(): void {
    this.#abort?.abort()
    this.#abort = null
    const pending = this.#pending
    if (pending) {
      clearTimeout(pending.timeout)
      this.#pending = null
      const window = this.options.getWindow()
      if (window && !window.isDestroyed()) window.webContents.send(TTS_STOP_CHANNEL, pending.id)
      pending.resolve('aborted')
    }
    if (this.#status.phase !== 'idle') this.#setStatus({ phase: 'idle', error: null })
  }

  dispose(): void {
    this.stop()
  }

  #isConfigured(providerId: TtsProviderId): boolean {
    const settings = this.options.settings.get().tts
    if (providerId === 'gemini') return this.options.secrets.hasTtsApiKey('gemini')
    return (
      this.options.secrets.hasTtsApiKey('elevenlabs') && Boolean(settings.elevenLabsVoiceId)
    )
  }

  #refreshLocal(): TtsSnapshot {
    this.#snapshot = this.#buildSnapshot()
    this.#setStatus({ phase: 'idle', error: null })
    this.#emitSnapshot()
    return this.#snapshot
  }

  #buildSnapshot(error: string | null = null): TtsSnapshot {
    const settings = this.options.settings.get().tts
    return {
      ...settings,
      geminiVoices: GEMINI_TTS_VOICES,
      elevenLabsVoices: this.#elevenLabsVoices,
      hasGeminiApiKey: this.options.secrets.hasTtsApiKey('gemini'),
      hasElevenLabsApiKey: this.options.secrets.hasTtsApiKey('elevenlabs'),
      keychainAvailable: this.options.secrets.keychainAvailable,
      configured: settings.enabled && this.#isConfigured(settings.providerId),
      error
    }
  }

  #setStatus(status: TtsStatus): void {
    this.#status = status
    const window = this.options.getWindow()
    if (window && !window.isDestroyed()) window.webContents.send(TTS_STATUS_CHANNEL, status)
  }

  #emitSnapshot(): void {
    const window = this.options.getWindow()
    if (window && !window.isDestroyed()) {
      window.webContents.send(TTS_SNAPSHOT_CHANNEL, this.#snapshot)
    }
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}
