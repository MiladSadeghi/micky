import { GEMINI_TTS_MODEL_ID, type TtsSettings } from '@/lib/tts'
import type { SynthesizedAudio, TtsProvider } from './provider'
import { throwResponseError } from './provider'

const GEMINI_API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models'

type GeminiTtsResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }>
    }
  }>
  error?: { message?: string }
}

export class GeminiTtsProvider implements TtsProvider {
  constructor(private readonly getApiKey: () => string | null) {}

  async synthesize(
    text: string,
    settings: TtsSettings,
    signal: AbortSignal
  ): Promise<SynthesizedAudio> {
    const apiKey = this.getApiKey()
    if (!apiKey) throw new Error('کلید Gemini را از تنظیمات صدا اضافه کن.')

    const response = await fetch(
      `${GEMINI_API_ROOT}/${GEMINI_TTS_MODEL_ID}:generateContent`,
      {
        method: 'POST',
        signal,
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Speak this Persian-first assistant reply naturally, warmly, and conversationally. Recite only the reply without adding or changing words:\n\n${text}`
                }
              ]
            }
          ],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: settings.geminiVoice }
              }
            }
          }
        })
      }
    )
    if (!response.ok) await throwResponseError(response, 'Gemini')

    const body = (await response.json()) as GeminiTtsResponse
    const data = body.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)
      ?.inlineData?.data
    if (!data) throw new Error(body.error?.message || 'Gemini صدایی برنگرداند.')

    const pcm = Buffer.from(data, 'base64')
    return {
      mimeType: 'audio/wav',
      bytes: pcm16MonoToWav(pcm, 24_000)
    }
  }
}

export function pcm16MonoToWav(pcm: Uint8Array, sampleRate: number): Uint8Array {
  const headerSize = 44
  const wav = Buffer.allocUnsafe(headerSize + pcm.byteLength)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(36 + pcm.byteLength, 4)
  wav.write('WAVE', 8)
  wav.write('fmt ', 12)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(sampleRate, 24)
  wav.writeUInt32LE(sampleRate * 2, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(pcm.byteLength, 40)
  Buffer.from(pcm).copy(wav, headerSize)
  return wav
}
