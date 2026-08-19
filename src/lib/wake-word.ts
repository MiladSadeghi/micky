export const WAKE_WORD_SAMPLE_RATE = 16_000
export const WAKE_WORD_WINDOW_SAMPLES = WAKE_WORD_SAMPLE_RATE * 2
export const WAKE_WORD_HOP_SAMPLES = Math.round(WAKE_WORD_SAMPLE_RATE * 0.16)
export const WAKE_WORD_CHUNK_SAMPLES = 1_280
export const WAKE_WORD_DEFAULT_THRESHOLD = 0.73

export type WakeWordPhase = 'disabled' | 'loading' | 'listening' | 'activated' | 'error'

export type WakeWordStatus = {
  phase: WakeWordPhase
  enabled: boolean
  captureRequested: boolean
  latestScore: number
  lastDetectionAt: number | null
  error: string | null
}

export type WakeWordActivation = {
  confidence: number
  detectedAt: number
  source: 'wake-word' | 'manual'
}

export const INITIAL_WAKE_WORD_STATUS: WakeWordStatus = {
  phase: 'loading',
  enabled: true,
  captureRequested: false,
  latestScore: 0,
  lastDetectionAt: null,
  error: null
}

export function isWakeWordAudioPayload(value: unknown): value is ArrayBuffer {
  return (
    value instanceof ArrayBuffer &&
    value.byteLength > 0 &&
    value.byteLength <= WAKE_WORD_SAMPLE_RATE * Float32Array.BYTES_PER_ELEMENT &&
    value.byteLength % Float32Array.BYTES_PER_ELEMENT === 0
  )
}
