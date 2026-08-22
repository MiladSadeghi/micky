import { existsSync } from 'node:fs'
import { Worker } from 'node:worker_threads'
import type { BrowserWindow } from 'electron'
import {
  INITIAL_WAKE_WORD_STATUS,
  WAKE_WORD_DEFAULT_THRESHOLD,
  type WakeWordActivation,
  type WakeWordStatus
} from '@/lib/wake-word'

type WakeWordResources = {
  melModelPath: string
  embeddingModelPath: string
  classifierModelPath: string
}

type WakeWordWorkerMessage =
  | { type: 'ready' }
  | { type: 'reset'; id: number }
  | { type: 'score'; score: number }
  | { type: 'detected'; score: number }
  | { type: 'error'; error: string }

type WakeWordServiceOptions = {
  workerScript: string
  resources: WakeWordResources
  getWindow: () => BrowserWindow | null
  createWorker?: (script: string) => Worker
  enabled?: boolean
  onActivated?: (activation: WakeWordActivation) => void
  onResume?: () => void
}

export const WAKE_WORD_STATUS_CHANNEL = 'wake-word:status'
export const WAKE_WORD_ACTIVATION_CHANNEL = 'wake-word:activation'

const SCORE_BROADCAST_INTERVAL_MS = 240

export class WakeWordService {
  #worker: Worker | null = null
  #workerReady = false
  #resetId = 0
  #pendingResumeResetId: number | null = null
  #captureSuppressed = false
  #status: WakeWordStatus = INITIAL_WAKE_WORD_STATUS
  #lastScoreBroadcast = 0
  #disposed = false

  constructor(private readonly options: WakeWordServiceOptions) {
    if (options.enabled === false) {
      this.#status = { ...INITIAL_WAKE_WORD_STATUS, enabled: false, phase: 'disabled' }
    }
  }

  initialize(): void {
    this.#startWorker()
  }

  getStatus(): WakeWordStatus {
    return this.#status
  }

  setEnabled(enabled: boolean): WakeWordStatus {
    if (enabled === this.#status.enabled && this.#status.phase !== 'error') {
      return this.#status
    }

    this.#status = { ...this.#status, enabled, error: null, latestScore: 0 }
    if (!enabled) {
      this.options.onResume?.()
      // Keep the ONNX worker alive while muted. Abruptly terminating a worker in
      // the middle of native inference can take down the Electron main process.
      // Reset is serialized behind any inference already in progress.
      this.#pendingResumeResetId = null
      this.#resetWorker(false)
      this.#update({ phase: 'disabled', captureRequested: false })
    } else if (this.#worker) {
      if (this.#workerReady) {
        this.#resetWorker(!this.#captureSuppressed)
        this.#update({
          phase: this.#captureSuppressed ? 'activated' : 'loading',
          captureRequested: false
        })
      } else {
        this.#update({
          phase: this.#captureSuppressed ? 'activated' : 'loading',
          captureRequested: false
        })
      }
    } else {
      this.#startWorker()
    }
    return this.#status
  }

  retry(): WakeWordStatus {
    if (!this.#status.enabled) return this.setEnabled(true)
    if (this.#worker && this.#workerReady) {
      this.#status = { ...this.#status, error: null, latestScore: 0 }
      this.#resetWorker(true)
      this.#update({ phase: 'loading', captureRequested: false })
      return this.#status
    }
    this.#stopWorker()
    this.#startWorker()
    return this.#status
  }

  processAudio(buffer: ArrayBuffer): void {
    if (!this.#worker || this.#status.phase !== 'listening' || !this.#status.captureRequested) {
      return
    }
    this.#worker.postMessage({ type: 'audio', samples: buffer }, [buffer])
  }

  reportCaptureError(error: string): void {
    if (!this.#status.enabled) return
    this.#update({
      phase: 'error',
      captureRequested: false,
      error: error.trim() || 'Microphone capture failed.'
    })
  }

  activateManually(): WakeWordStatus {
    if (!this.#status.enabled) return this.setEnabled(true)
    if (this.#status.phase === 'error') return this.retry()
    if (this.#status.phase === 'activated') {
      this.resumeListening()
      return this.#status
    }
    if (this.#status.phase === 'listening') this.#activate('manual', 1)
    return this.#status
  }

  beginExternalSession(): void {
    this.#captureSuppressed = false
    this.#worker?.postMessage({ type: 'reset' })
    this.#update({ phase: 'activated', captureRequested: true, latestScore: 0, error: null })
  }

  pauseCapture(): void {
    this.#captureSuppressed = true
    this.#resetWorker(false)
    this.#update({
      phase: this.#status.enabled ? 'activated' : 'disabled',
      captureRequested: false,
      latestScore: 0,
      error: null
    })
  }

  endExternalSession(): void {
    this.#captureSuppressed = false
    if (!this.#status.enabled) {
      this.#update({ phase: 'disabled', captureRequested: false, latestScore: 0 })
      return
    }
    this.resumeListening()
  }

  resumeListening(): void {
    this.#captureSuppressed = false
    this.options.onResume?.()
    if (!this.#status.enabled || !this.#worker) return
    this.#worker.postMessage({ type: 'reset' })
    this.#update({
      phase: 'listening',
      captureRequested: true,
      latestScore: 0,
      error: null
    })
  }

  dispose(): void {
    this.#disposed = true
    this.#stopWorker()
  }

  #startWorker(): void {
    if (this.#disposed || this.#worker || !this.#status.enabled) return

    const missingResource = [
      this.options.workerScript,
      this.options.resources.melModelPath,
      this.options.resources.embeddingModelPath,
      this.options.resources.classifierModelPath
    ].find((candidate) => !existsSync(candidate))

    if (missingResource) {
      this.#update({
        phase: 'error',
        captureRequested: false,
        error: `Wake-word resource is missing: ${missingResource}`
      })
      return
    }

    this.#update({ phase: 'loading', captureRequested: false, error: null })
    const worker =
      this.options.createWorker?.(this.options.workerScript) ??
      new Worker(this.options.workerScript)
    this.#worker = worker
    this.#workerReady = false

    worker.on('message', (message: WakeWordWorkerMessage) => {
      if (worker === this.#worker) this.#handleWorkerMessage(message)
    })
    worker.on('error', (error) => {
      if (worker !== this.#worker) return
      this.#worker = null
      this.#workerReady = false
      this.#pendingResumeResetId = null
      if (!this.#status.enabled) return
      this.#update({ phase: 'error', captureRequested: false, error: error.message })
    })
    worker.on('exit', (code) => {
      if (worker !== this.#worker) return
      this.#worker = null
      this.#workerReady = false
      this.#pendingResumeResetId = null
      if (!this.#disposed && this.#status.enabled && code !== 0) {
        this.#update({
          phase: 'error',
          captureRequested: false,
          error: `Wake-word worker stopped with code ${code}.`
        })
      }
    })
    worker.postMessage({
      type: 'initialize',
      resources: this.options.resources,
      threshold: WAKE_WORD_DEFAULT_THRESHOLD
    })
  }

  #stopWorker(): void {
    const worker = this.#worker
    this.#worker = null
    this.#workerReady = false
    this.#pendingResumeResetId = null
    if (worker) void worker.terminate()
  }

  #resetWorker(resumeAfter: boolean): void {
    if (!this.#worker || !this.#workerReady) return
    const id = ++this.#resetId
    this.#pendingResumeResetId = resumeAfter ? id : null
    this.#worker.postMessage({ type: 'reset', id })
  }

  #handleWorkerMessage(message: WakeWordWorkerMessage): void {
    if (message.type === 'ready') {
      this.#workerReady = true
      if (!this.#status.enabled) return
      if (this.#captureSuppressed) {
        this.#update({
          phase: 'activated',
          captureRequested: false,
          latestScore: 0,
          error: null
        })
        return
      }
      this.#update({
        phase: 'listening',
        captureRequested: true,
        latestScore: 0,
        error: null
      })
      return
    }
    if (message.type === 'reset') {
      if (message.id !== this.#pendingResumeResetId) return
      this.#pendingResumeResetId = null
      if (!this.#status.enabled) return
      if (this.#captureSuppressed) {
        this.#update({ phase: 'activated', captureRequested: false, latestScore: 0, error: null })
        return
      }
      this.#update({ phase: 'listening', captureRequested: true, latestScore: 0, error: null })
      return
    }
    if (message.type === 'error') {
      if (!this.#workerReady) this.#stopWorker()
      if (!this.#status.enabled) return
      this.#update({ phase: 'error', captureRequested: false, error: message.error })
      return
    }
    if (message.type === 'score') {
      this.#status = { ...this.#status, latestScore: message.score }
      const now = Date.now()
      if (now - this.#lastScoreBroadcast >= SCORE_BROADCAST_INTERVAL_MS) {
        this.#lastScoreBroadcast = now
        this.#emitStatus()
      }
      return
    }
    if (this.#status.phase === 'listening') this.#activate('wake-word', message.score)
  }

  #activate(source: WakeWordActivation['source'], confidence: number): void {
    const detectedAt = Date.now()
    this.#worker?.postMessage({ type: 'reset' })
    this.#update({
      phase: 'activated',
      captureRequested: true,
      latestScore: confidence,
      lastDetectionAt: detectedAt,
      error: null
    })

    const activation: WakeWordActivation = { confidence, detectedAt, source }
    const window = this.options.getWindow()
    if (window && !window.isDestroyed()) {
      window.webContents.send(WAKE_WORD_ACTIVATION_CHANNEL, activation)
    }
    this.options.onActivated?.(activation)
  }

  #update(update: Partial<WakeWordStatus>): void {
    this.#status = { ...this.#status, ...update }
    this.#emitStatus()
  }

  #emitStatus(): void {
    const window = this.options.getWindow()
    if (window && !window.isDestroyed()) {
      window.webContents.send(WAKE_WORD_STATUS_CHANNEL, this.#status)
    }
  }
}
