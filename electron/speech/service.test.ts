import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_ENDPOINT_SETTINGS, type EndpointSettings } from '@/lib/asr'
import { SpeechService } from './service'
import type { SpeechLoadOptions, SpeechProvider, SpeechProviderHandlers } from './provider'

class FakeSpeechProvider implements SpeechProvider {
  readonly capabilities = { streaming: true }
  starts = 0
  stops = 0

  constructor(readonly handlers: SpeechProviderHandlers) {}

  async load(_options: SpeechLoadOptions): Promise<void> {}
  startUtterance(): void {
    this.starts += 1
  }
  acceptAudio(_samples: ArrayBuffer): void {}
  stopUtterance(): void {
    this.stops += 1
    this.handlers.onFinal('')
  }
  dispose(): void {}
}

function createHarness(endpoint: EndpointSettings = DEFAULT_ENDPOINT_SETTINGS): {
  service: SpeechService
  provider: FakeSpeechProvider
  finalTexts: string[]
} {
  let provider: FakeSpeechProvider | null = null
  const finalTexts: string[] = []
  const service = new SpeechService({
    models: {
      isInstalled: () => true,
      getModelDir: () => '/unused/model'
    } as never,
    settings: {
      get: () => ({ activeModelId: 'shenava', endpoint })
    } as never,
    getWindow: () => null,
    getPreroll: () => new ArrayBuffer(0),
    onSessionEnd: () => undefined,
    onFinalTranscript: (text) => finalTexts.push(text),
    createProvider: (handlers) => {
      provider = new FakeSpeechProvider(handlers)
      return provider
    }
  })

  assert.ok(provider)
  return { service, provider, finalTexts }
}

test('keeps a conversation open across recognizer endpoints', async () => {
  const { service, provider, finalTexts } = createHarness()
  await service.startSession({ preroll: false, mode: 'conversation' })

  provider.handlers.onEndpoint('بخش اول حرف من')

  assert.equal(service.isSessionActive(), true)
  assert.equal(provider.starts, 2)
  assert.equal(provider.stops, 0)
  assert.equal(service.getStatus().transcript?.text, 'بخش اول حرف من')
  assert.deepEqual(finalTexts, [])

  provider.handlers.onPartial('و ادامه حرف من')
  assert.equal(service.getStatus().transcript?.text, 'بخش اول حرف من و ادامه حرف من')

  service.finishSession()
  assert.equal(provider.stops, 1)
  assert.deepEqual(finalTexts, ['بخش اول حرف من و ادامه حرف من'])
})

test('preserves an endpoint segment when finalizing during its grace period', async () => {
  const { service, provider, finalTexts } = createHarness()
  await service.startSession({ preroll: false, mode: 'conversation' })

  provider.handlers.onEndpoint('همین جمله کامل است')
  service.finishSession()

  assert.deepEqual(finalTexts, ['همین جمله کامل است'])
})
