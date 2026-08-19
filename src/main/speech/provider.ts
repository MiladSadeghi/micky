import { join } from 'node:path'
import { utilityProcess, type UtilityProcess } from 'electron'
import {
  ASR_NUM_THREADS,
  type AsrProcessRequest,
  type AsrProcessResponse,
  type EndpointSettings
} from '../../shared/asr'

export type SpeechProviderCapabilities = {
  streaming: boolean
}

export type SpeechProviderHandlers = {
  onPartial: (text: string) => void
  onEndpoint: (text: string) => void
  onFinal: (text: string) => void
  onError: (error: string) => void
}

export type SpeechLoadOptions = {
  modelDir: string
  endpoint: EndpointSettings
}

export interface SpeechProvider {
  readonly capabilities: SpeechProviderCapabilities
  load(options: SpeechLoadOptions): Promise<void>
  startUtterance(): void
  acceptAudio(samples: ArrayBuffer): void
  stopUtterance(): void
  dispose(): void
}

type LocalShenavaProviderOptions = {
  scriptPath: string
  handlers: SpeechProviderHandlers
}

export class LocalShenavaProvider implements SpeechProvider {
  readonly capabilities: SpeechProviderCapabilities = { streaming: true }
  #child: UtilityProcess | null = null
  #ready: Promise<void> | null = null
  #readyResolve: (() => void) | null = null
  #readyReject: ((error: Error) => void) | null = null
  #loadedDir: string | null = null
  #stopping = false

  constructor(private readonly options: LocalShenavaProviderOptions) {}

  async load(options: SpeechLoadOptions): Promise<void> {
    if (this.#loadedDir === options.modelDir && this.#child) return this.#awaitReady()

    this.dispose()
    this.#ready = new Promise<void>((resolve, reject) => {
      this.#readyResolve = resolve
      this.#readyReject = reject
    })

    const child = utilityProcess.fork(this.options.scriptPath, [], {
      serviceName: 'micky-asr',
      stdio: 'pipe'
    })
    this.#child = child
    child.stderr?.on('data', (chunk: Buffer | string) => {
      console.error('[asr]', String(chunk).trimEnd())
    })
    child.on('message', (message: AsrProcessResponse) => this.#handleMessage(message))
    child.on('exit', (code) => {
      if (this.#child !== child) return
      this.#child = null
      this.#loadedDir = null
      const error = new Error(`ASR process stopped (${code ?? 'unknown'}).`)
      this.#readyReject?.(error)
      this.#readyResolve = null
      this.#readyReject = null
      if (!this.#stopping) this.options.handlers.onError(error.message)
    })

    this.#send({
      type: 'initialize',
      modelPath: join(options.modelDir, 'model.int8.onnx'),
      tokensPath: join(options.modelDir, 'tokens.txt'),
      numThreads: ASR_NUM_THREADS,
      endpoint: options.endpoint
    })
    this.#loadedDir = options.modelDir
    await this.#awaitReady()
  }

  startUtterance(): void {
    this.#stopping = false
    this.#send({ type: 'start' })
  }

  acceptAudio(samples: ArrayBuffer): void {
    this.#send({ type: 'audio', samples })
  }

  stopUtterance(): void {
    this.#stopping = true
    this.#send({ type: 'stop' })
  }

  dispose(): void {
    this.#stopping = true
    const child = this.#child
    this.#child = null
    this.#loadedDir = null
    this.#ready = null
    this.#readyResolve = null
    this.#readyReject = null
    if (!child) return
    try {
      child.postMessage({ type: 'dispose' } satisfies AsrProcessRequest)
    } catch {
      // The process may already be gone.
    }
    child.kill()
  }

  #handleMessage(message: AsrProcessResponse): void {
    if (message.type === 'ready') {
      this.#readyResolve?.()
      this.#readyResolve = null
      this.#readyReject = null
      return
    }
    if (message.type === 'partial') {
      this.options.handlers.onPartial(message.text)
      return
    }
    if (message.type === 'endpoint') {
      this.options.handlers.onEndpoint(message.text)
      return
    }
    if (message.type === 'final') {
      this.options.handlers.onFinal(message.text)
      return
    }
    this.options.handlers.onError(message.error)
  }

  #send(message: AsrProcessRequest): void {
    this.#child?.postMessage(message)
  }

  #awaitReady(): Promise<void> {
    return this.#ready ?? Promise.reject(new Error('ASR process is not loading.'))
  }
}
