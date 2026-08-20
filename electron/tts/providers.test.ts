import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_TTS_SETTINGS, ELEVENLABS_TTS_MODEL_ID, GEMINI_TTS_MODEL_ID } from '@/lib/tts'
import { ElevenLabsTtsProvider } from './elevenlabs'
import { GeminiTtsProvider, pcm16MonoToWav } from './gemini'
import { throwResponseError } from './provider'

test('wraps Gemini 24 kHz PCM in a valid mono WAV file', () => {
  const wav = pcm16MonoToWav(Uint8Array.from([1, 2, 3, 4]), 24_000)
  const view = Buffer.from(wav)
  assert.equal(view.toString('ascii', 0, 4), 'RIFF')
  assert.equal(view.toString('ascii', 8, 12), 'WAVE')
  assert.equal(view.readUInt32LE(24), 24_000)
  assert.equal(view.readUInt16LE(22), 1)
  assert.equal(view.readUInt16LE(34), 16)
  assert.deepEqual([...view.subarray(44)], [1, 2, 3, 4])
})

test('requests Gemini 2.5 Flash TTS with the selected voice', async (t) => {
  let requestUrl = ''
  let requestInit: RequestInit | undefined
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    requestUrl = String(input)
    requestInit = init
    return Response.json({
      candidates: [{ content: { parts: [{ inlineData: { data: 'AQIDBA==' } }] } }]
    })
  })
  const provider = new GeminiTtsProvider(() => 'gemini-key')
  const result = await provider.synthesize(
    'سلام',
    { ...DEFAULT_TTS_SETTINGS, geminiVoice: 'Kore' },
    new AbortController().signal
  )

  assert.match(requestUrl, new RegExp(`${GEMINI_TTS_MODEL_ID}:generateContent$`))
  assert.equal(new Headers(requestInit?.headers).get('x-goog-api-key'), 'gemini-key')
  const body = JSON.parse(String(requestInit?.body))
  assert.equal(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Kore')
  assert.equal(result.mimeType, 'audio/wav')
  assert.equal(Buffer.from(result.bytes).toString('ascii', 0, 4), 'RIFF')
})

test('requests ElevenLabs v3 in Persian and returns MP3 bytes', async (t) => {
  let requestUrl = ''
  let requestInit: RequestInit | undefined
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    requestUrl = String(input)
    requestInit = init
    return new Response(Uint8Array.from([9, 8, 7]), {
      headers: { 'content-type': 'audio/mpeg' }
    })
  })
  const provider = new ElevenLabsTtsProvider(() => 'eleven-key')
  const result = await provider.synthesize(
    'سلام',
    { ...DEFAULT_TTS_SETTINGS, providerId: 'elevenlabs', elevenLabsVoiceId: 'voice/id' },
    new AbortController().signal
  )

  assert.match(requestUrl, /\/v1\/text-to-speech\/voice%2Fid\?output_format=mp3_44100_128$/)
  assert.equal(new Headers(requestInit?.headers).get('xi-api-key'), 'eleven-key')
  const body = JSON.parse(String(requestInit?.body))
  assert.equal(body.model_id, ELEVENLABS_TTS_MODEL_ID)
  assert.equal(body.language_code, 'fa')
  assert.deepEqual([...result.bytes], [9, 8, 7])
})

test('loads the authenticated ElevenLabs voice catalog', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({
      voices: [
        {
          voice_id: 'voice-1',
          name: 'Micky',
          category: 'cloned',
          labels: { accent: 'Persian', gender: 'male' }
        }
      ]
    })
  )
  const provider = new ElevenLabsTtsProvider(() => 'eleven-key')
  assert.deepEqual(await provider.listVoices(), [
    { id: 'voice-1', label: 'Micky', description: 'Persian · male · cloned' }
  ])
})

test('surfaces ElevenLabs errors when detail.message is an array', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json(
      { detail: { status: 'missing_permissions', message: ['voices_read'] } },
      { status: 401 }
    )
  )
  const provider = new ElevenLabsTtsProvider(() => 'restricted-key')
  await assert.rejects(() => provider.listVoices(), {
    message: 'voices_read'
  })
})

test('surfaces Gemini-style error.message strings', async () => {
  await assert.rejects(
    () =>
      throwResponseError(
        Response.json({ error: { message: 'API key not valid.' } }, { status: 400 }),
        'Gemini'
      ),
    { message: 'API key not valid.' }
  )
})

test('falls back to a Persian status line when the error body has no text', async () => {
  await assert.rejects(
    () => throwResponseError(Response.json({ detail: { code: 401 } }, { status: 401 }), 'ElevenLabs'),
    { message: 'ElevenLabs با خطای 401 جواب داد.' }
  )
})
