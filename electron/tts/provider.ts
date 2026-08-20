import type { TtsSettings, TtsVoice } from '@/lib/tts'

export type SynthesizedAudio = {
  mimeType: string
  bytes: Uint8Array
}

export interface TtsProvider {
  synthesize(text: string, settings: TtsSettings, signal: AbortSignal): Promise<SynthesizedAudio>
  listVoices?(signal?: AbortSignal): Promise<TtsVoice[]>
}

export async function throwResponseError(response: Response, provider: string): Promise<never> {
  let detail = ''
  try {
    detail = errorText(await response.json())
  } catch {
    // Some provider errors are not JSON.
  }
  throw new Error(detail || `${provider} با خطای ${response.status} جواب داد.`)
}

function errorText(value: unknown, depth = 0): string {
  if (depth > 4) return ''
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) {
    return value
      .map((item) => errorText(item, depth + 1))
      .filter(Boolean)
      .join(' · ')
  }
  if (!value || typeof value !== 'object') return ''
  const record = value as Record<string, unknown>
  return (
    errorText(record.message, depth + 1) ||
    errorText(record.msg, depth + 1) ||
    errorText(record.detail, depth + 1) ||
    errorText(record.error, depth + 1) ||
    errorText(record.status, depth + 1)
  )
}
