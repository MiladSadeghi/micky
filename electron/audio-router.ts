import { ASR_PREROLL_SAMPLES } from '@/lib/asr'
import type { SpeechService } from './speech/service'
import type { WakeWordService } from './wake-word/service'

export class PrerollBuffer {
  readonly #samples: Float32Array
  #writeIndex = 0
  #count = 0

  constructor(sampleCount = ASR_PREROLL_SAMPLES) {
    this.#samples = new Float32Array(sampleCount)
  }

  append(chunk: Float32Array): void {
    for (const sample of chunk) {
      this.#samples[this.#writeIndex] = sample
      this.#writeIndex = (this.#writeIndex + 1) % this.#samples.length
    }
    this.#count = Math.min(this.#samples.length, this.#count + chunk.length)
  }

  snapshot(): ArrayBuffer {
    if (this.#count === 0) return new ArrayBuffer(0)
    if (this.#count < this.#samples.length) {
      return this.#samples.slice(0, this.#count).buffer
    }

    const output = new Float32Array(this.#samples.length)
    output.set(this.#samples.subarray(this.#writeIndex), 0)
    output.set(this.#samples.subarray(0, this.#writeIndex), this.#samples.length - this.#writeIndex)
    return output.buffer
  }

  clear(): void {
    this.#samples.fill(0)
    this.#writeIndex = 0
    this.#count = 0
  }
}

export class AudioRouter {
  readonly #preroll = new PrerollBuffer()

  constructor(
    private readonly getWakeWord: () => WakeWordService | null,
    private readonly getSpeech: () => SpeechService | null
  ) {}

  process(buffer: ArrayBuffer): void {
    this.#preroll.append(new Float32Array(buffer))
    const wakeWord = this.getWakeWord()
    const phase = wakeWord?.getStatus().phase
    if (phase === 'listening' && wakeWord) {
      wakeWord.processAudio(buffer)
      return
    }
    if (phase === 'activated') {
      this.getSpeech()?.processAudio(buffer)
    }
  }

  takePreroll(): ArrayBuffer {
    const snapshot = this.#preroll.snapshot()
    this.#preroll.clear()
    return snapshot
  }
}
