import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { ASR_RULE3_UTTERANCE_LIMIT_SECONDS } from '@/lib/asr'
import { DEFAULT_ASR_MODEL_ID } from '@/lib/asr-models'
import { DEFAULT_LLM_BASE_URLS, DEFAULT_LLM_MODEL_ID } from '@/lib/llm'
import { DEFAULT_TTS_SETTINGS } from '@/lib/tts'
import { DEFAULT_APP_SETTINGS, SettingsStore } from './store'
import {
  DEFAULT_ASSISTANT_SHORTCUT,
  DEFAULT_DICTATION_SHORTCUT,
  DEFAULT_VISION_MODEL_ID
} from '@/lib/settings'

test('loads defaults when no settings file exists', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'micky-settings-'))
  const store = new SettingsStore(dir)
  const settings = await store.load()
  assert.equal(settings.activeModelId, DEFAULT_ASR_MODEL_ID)
  assert.equal(settings.wakeWordEnabled, true)
  assert.equal(settings.onboardingCompleted, false)
  assert.equal(settings.systemToolsEnabled, true)
  assert.equal(settings.llm.modelId, DEFAULT_LLM_MODEL_ID)
  assert.equal(settings.llm.providerModelIds.openrouter, DEFAULT_LLM_MODEL_ID)
  assert.deepEqual(settings.llm.baseUrls, DEFAULT_LLM_BASE_URLS)
  assert.deepEqual(settings.llm.customModelIds, [])
  assert.deepEqual(settings.tts, DEFAULT_TTS_SETTINGS)
  assert.equal(settings.assistantShortcut, DEFAULT_ASSISTANT_SHORTCUT)
  assert.equal(settings.dictationShortcut, DEFAULT_DICTATION_SHORTCUT)
  assert.equal(settings.dictationAiCleanup, true)
  assert.equal(settings.dictationAutoPaste, true)
  assert.equal(settings.launchAtLogin, false)
  assert.equal(settings.visionModelId, DEFAULT_VISION_MODEL_ID)
  assert.equal(settings.screenDisclosureAccepted, false)
  assert.equal(settings.chatHistoryEnabled, true)
})

test('normalizes invalid persisted values on load', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'micky-settings-'))
  await writeFile(
    join(dir, 'settings.json'),
    JSON.stringify({
      activeModelId: 'not-a-model',
      wakeWordEnabled: 'yes',
      onboardingCompleted: 1,
      llm: {
        modelId: '  custom/model  ',
        customModelIds: ['', 'qwen/qwen3.7-flash', 'ok/model']
      },
      tts: { providerId: 'bad', geminiVoice: 'bad', elevenLabsVoiceId: 4 }
    }),
    'utf8'
  )

  const store = new SettingsStore(dir)
  const settings = await store.load()
  assert.equal(settings.activeModelId, DEFAULT_APP_SETTINGS.activeModelId)
  assert.equal(settings.wakeWordEnabled, true)
  assert.equal(settings.onboardingCompleted, false)
  assert.equal(settings.llm.modelId, 'custom/model')
  assert.deepEqual(settings.llm.customModelIds, ['ok/model'])
  assert.deepEqual(settings.tts, DEFAULT_TTS_SETTINGS)
  assert.equal(settings.assistantShortcut, DEFAULT_ASSISTANT_SHORTCUT)
  assert.equal(settings.dictationAiCleanup, true)
  assert.equal(settings.chatHistoryEnabled, true)
})

test('migrates the old twenty-second utterance endpoint', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'micky-settings-'))
  await writeFile(
    join(dir, 'settings.json'),
    JSON.stringify({ endpoint: { rule3MinUtteranceLength: 20 } }),
    'utf8'
  )

  const store = new SettingsStore(dir)
  const settings = await store.load()
  assert.equal(settings.endpoint.rule3MinUtteranceLength, ASR_RULE3_UTTERANCE_LIMIT_SECONDS)
})

test('normalizes and remembers separate compatible-provider settings', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'micky-settings-'))
  await writeFile(
    join(dir, 'settings.json'),
    JSON.stringify({
      llm: {
        providerId: 'ollama',
        modelId: 'legacy-model',
        providerModelIds: { openrouter: 'cloud/model', ollama: 'qwen3:8b' },
        baseUrls: { ollama: 'http://localhost:9999/v1' }
      }
    }),
    'utf8'
  )

  const store = new SettingsStore(dir)
  const settings = await store.load()
  assert.equal(settings.llm.providerId, 'ollama')
  assert.equal(settings.llm.modelId, 'qwen3:8b')
  assert.equal(settings.llm.providerModelIds.openrouter, 'cloud/model')
  assert.equal(settings.llm.baseUrls.ollama, 'http://localhost:9999/v1')
  assert.equal(settings.llm.baseUrls.lmstudio, DEFAULT_LLM_BASE_URLS.lmstudio)
})

test('persists a patch to disk', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'micky-settings-'))
  const store = new SettingsStore(dir)
  await store.load()
  await store.update({
    wakeWordEnabled: false,
    onboardingCompleted: true,
    tts: { providerId: 'elevenlabs', elevenLabsVoiceId: 'voice-1' }
  })
  const raw = JSON.parse(await readFile(join(dir, 'settings.json'), 'utf8')) as {
    wakeWordEnabled: boolean
    onboardingCompleted: boolean
    tts: { providerId: string; elevenLabsVoiceId: string }
  }
  assert.equal(raw.wakeWordEnabled, false)
  assert.equal(raw.onboardingCompleted, true)
  assert.deepEqual(raw.tts, {
    ...DEFAULT_TTS_SETTINGS,
    providerId: 'elevenlabs',
    elevenLabsVoiceId: 'voice-1'
  })
})
