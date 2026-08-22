export const ASR_SAMPLE_RATE = 16_000
export const ASR_FEATURE_DIM = 80
export const ASR_PREROLL_MS = 250
export const ASR_PREROLL_SAMPLES = Math.round(ASR_SAMPLE_RATE * (ASR_PREROLL_MS / 1_000))
// End a stalled recognizer session, not a healthy long dictation. The timer is
// refreshed whenever the recognizer produces new partial text.
export const ASR_STALL_TIMEOUT_MS = 45_000
export const ASR_PENDING_AUDIO_LIMIT_MS = 30_000
// Sherpa's rule 3 is a hard utterance-length endpoint. Keep it out of the way
// and let the trailing-silence rules decide when a person has finished.
export const ASR_RULE3_UTTERANCE_LIMIT_SECONDS = 60 * 60
// Endpoint detection can split speech at a short thinking pause. Preserve the
// segment and wait for a more deliberate silence before submitting it.
export const ASR_CONVERSATION_END_SILENCE_MS = 1_800
export const ASR_DICTATION_END_SILENCE_MS = 3_000
export const ASR_FINAL_HOLD_MS = 900
export const ASR_PROGRESS_BROADCAST_INTERVAL_MS = 240
export const ASR_NUM_THREADS = 2

export const AUDIO_CHUNK_CHANNEL = 'audio:chunk'
export const SPEECH_STATUS_CHANNEL = 'speech:status'
export const SPEECH_TRANSCRIPT_CHANNEL = 'speech:transcript'
export const MODELS_STATUS_CHANNEL = 'models:status'

export type SpeechPhase = 'idle' | 'loading' | 'listening' | 'finalizing' | 'error'
export type SpeechSessionMode = 'conversation' | 'dictation'

export type SpeechTranscript = {
  sessionId: string
  text: string
  isFinal: boolean
  updatedAt: number
  mode?: SpeechSessionMode
}

export type SpeechStatus = {
  phase: SpeechPhase
  modelId: string | null
  ready: boolean
  error: string | null
  transcript: SpeechTranscript | null
}

export const INITIAL_SPEECH_STATUS: SpeechStatus = {
  phase: 'idle',
  modelId: null,
  ready: false,
  error: null,
  transcript: null
}

export type ModelInstallState = 'missing' | 'downloading' | 'installed' | 'error'

export type AsrModelView = {
  id: string
  label: string
  description: string
  systemHint: string
  params: string
  bytes: number
  isDefault: boolean
  cardUrl: string
  state: ModelInstallState
  bytesDownloaded: number
  error: string | null
}

export type ModelsSnapshot = {
  activeModelId: string | null
  models: AsrModelView[]
}

export type EndpointSettings = {
  rule1MinTrailingSilence: number
  rule2MinTrailingSilence: number
  rule3MinUtteranceLength: number
}

export const DEFAULT_ENDPOINT_SETTINGS: EndpointSettings = {
  rule1MinTrailingSilence: 2.4,
  rule2MinTrailingSilence: 0.8,
  rule3MinUtteranceLength: ASR_RULE3_UTTERANCE_LIMIT_SECONDS
}

export type AsrProcessRequest =
  | {
      type: 'initialize'
      modelPath: string
      tokensPath: string
      numThreads: number
      endpoint: EndpointSettings
    }
  | { type: 'start' }
  | { type: 'audio'; samples: ArrayBuffer }
  | { type: 'stop' }
  | { type: 'dispose' }

export type AsrProcessResponse =
  | { type: 'ready' }
  | { type: 'partial'; text: string }
  | { type: 'endpoint'; text: string }
  | { type: 'final'; text: string }
  | { type: 'error'; error: string }
