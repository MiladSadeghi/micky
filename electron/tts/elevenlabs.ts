import { ELEVENLABS_TTS_MODEL_ID, type TtsSettings, type TtsVoice } from '@/lib/tts'
import type { SynthesizedAudio, TtsProvider } from './provider'
import { throwResponseError } from './provider'

const ELEVENLABS_API_ROOT = 'https://api.elevenlabs.io'

type ElevenLabsVoiceResponse = {
  voices?: Array<{
    voice_id?: string
    name?: string
    category?: string
    description?: string | null
    labels?: Record<string, string>
  }>
  has_more?: boolean
  next_page_token?: string | null
}

export class ElevenLabsTtsProvider implements TtsProvider {
  constructor(private readonly getApiKey: () => string | null) {}

  async synthesize(
    text: string,
    settings: TtsSettings,
    signal: AbortSignal
  ): Promise<SynthesizedAudio> {
    const apiKey = this.getApiKey()
    if (!apiKey) throw new Error('کلید ElevenLabs را از تنظیمات صدا اضافه کن.')
    if (!settings.elevenLabsVoiceId) throw new Error('یک صدای ElevenLabs انتخاب کن.')

    const voiceId = encodeURIComponent(settings.elevenLabsVoiceId)
    const response = await fetch(
      `${ELEVENLABS_API_ROOT}/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        signal,
        headers: {
          accept: 'audio/mpeg',
          'content-type': 'application/json',
          'xi-api-key': apiKey
        },
        body: JSON.stringify({
          text,
          model_id: ELEVENLABS_TTS_MODEL_ID,
          language_code: 'fa'
        })
      }
    )
    if (!response.ok) await throwResponseError(response, 'ElevenLabs')
    return {
      mimeType: response.headers.get('content-type')?.split(';')[0] || 'audio/mpeg',
      bytes: new Uint8Array(await response.arrayBuffer())
    }
  }

  async listVoices(signal?: AbortSignal): Promise<TtsVoice[]> {
    const apiKey = this.getApiKey()
    if (!apiKey) return []
    const voices: NonNullable<ElevenLabsVoiceResponse['voices']> = []
    let nextPageToken: string | null = null
    do {
      const params = new URLSearchParams({
        page_size: '100',
        sort: 'name',
        sort_direction: 'asc'
      })
      if (nextPageToken) params.set('next_page_token', nextPageToken)
      const response = await fetch(`${ELEVENLABS_API_ROOT}/v2/voices?${params}`, {
        signal,
        headers: { 'xi-api-key': apiKey }
      })
      if (!response.ok) await throwResponseError(response, 'ElevenLabs')
      const page = (await response.json()) as ElevenLabsVoiceResponse
      voices.push(...(page.voices ?? []))
      nextPageToken = page.has_more ? (page.next_page_token ?? null) : null
    } while (nextPageToken)

    return voices.flatMap((voice) => {
      const id = voice.voice_id?.trim()
      if (!id) return []
      const details = [voice.labels?.accent, voice.labels?.gender, voice.category]
        .filter(Boolean)
        .join(' · ')
      return [
        {
          id,
          label: voice.name?.trim() || id,
          description: voice.description?.trim() || details
        }
      ]
    })
  }
}
