export const TTS_SNAPSHOT_CHANNEL = 'tts:snapshot'
export const TTS_STATUS_CHANNEL = 'tts:status'
export const TTS_PLAYBACK_CHANNEL = 'tts:playback'
export const TTS_STOP_CHANNEL = 'tts:stop'

export const GEMINI_TTS_MODEL_ID = 'gemini-2.5-flash-preview-tts'
export const ELEVENLABS_TTS_MODEL_ID = 'eleven_v3'
export const GEMINI_KEYS_URL = 'https://aistudio.google.com/apikey'
export const ELEVENLABS_KEYS_URL = 'https://elevenlabs.io/app/settings/api-keys'

export type TtsProviderId = 'gemini' | 'elevenlabs'

export type TtsSettings = {
  enabled: boolean
  providerId: TtsProviderId
  geminiVoice: string
  elevenLabsVoiceId: string
}

export type TtsVoice = {
  id: string
  label: string
  description: string
}

export type TtsSnapshot = {
  enabled: boolean
  providerId: TtsProviderId
  geminiVoice: string
  elevenLabsVoiceId: string
  geminiVoices: TtsVoice[]
  elevenLabsVoices: TtsVoice[]
  hasGeminiApiKey: boolean
  hasElevenLabsApiKey: boolean
  keychainAvailable: boolean
  configured: boolean
  error: string | null
}

export type TtsPhase = 'idle' | 'synthesizing' | 'playing' | 'error'

export type TtsStatus = {
  phase: TtsPhase
  error: string | null
}

export type TtsPlayback = {
  id: string
  mimeType: string
  audio: ArrayBuffer
}

export function copyPlaybackAudio(audio: unknown): ArrayBuffer {
  const source = playbackSource(audio)
  const copy = new ArrayBuffer(source.byteLength)
  new Uint8Array(copy).set(source)
  return copy
}

function playbackSource(audio: unknown): Uint8Array {
  if (audio instanceof ArrayBuffer) return new Uint8Array(audio)
  if (audio instanceof Uint8Array) return audio
  if (ArrayBuffer.isView(audio)) {
    return new Uint8Array(audio.buffer, audio.byteOffset, audio.byteLength)
  }
  if (isNodeBufferJson(audio)) return Uint8Array.from(audio.data)
  return new Uint8Array()
}

function isNodeBufferJson(value: unknown): value is { type: 'Buffer'; data: number[] } {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    (value as { type?: unknown }).type === 'Buffer' &&
    Array.isArray((value as { data?: unknown }).data)
  )
}

export const INITIAL_TTS_STATUS: TtsStatus = { phase: 'idle', error: null }

export const GEMINI_TTS_VOICES: TtsVoice[] = [
  ['Zephyr', 'روشن'],
  ['Puck', 'سرزنده'],
  ['Charon', 'آگاه'],
  ['Kore', 'محکم'],
  ['Fenrir', 'هیجان‌زده'],
  ['Leda', 'جوان'],
  ['Orus', 'محکم'],
  ['Aoede', 'سبک'],
  ['Callirrhoe', 'آرام'],
  ['Autonoe', 'روشن'],
  ['Enceladus', 'نفس‌دار'],
  ['Iapetus', 'شفاف'],
  ['Umbriel', 'آرام'],
  ['Algieba', 'نرم'],
  ['Despina', 'نرم'],
  ['Erinome', 'شفاف'],
  ['Algenib', 'خش‌دار'],
  ['Rasalgethi', 'آگاه'],
  ['Laomedeia', 'سرزنده'],
  ['Achernar', 'ملایم'],
  ['Alnilam', 'محکم'],
  ['Schedar', 'یکنواخت'],
  ['Gacrux', 'پخته'],
  ['Pulcherrima', 'صریح'],
  ['Achird', 'دوستانه'],
  ['Zubenelgenubi', 'خودمانی'],
  ['Vindemiatrix', 'لطیف'],
  ['Sadachbia', 'پرانرژی'],
  ['Sadaltager', 'دانا'],
  ['Sulafat', 'گرم']
].map(([id, description]) => ({ id, label: id, description }))

export const DEFAULT_TTS_SETTINGS: TtsSettings = {
  enabled: false,
  providerId: 'gemini',
  geminiVoice: 'Sulafat',
  elevenLabsVoiceId: ''
}
