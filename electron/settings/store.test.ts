import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { DEFAULT_ASR_MODEL_ID } from '@/lib/asr-models'
import { DEFAULT_LLM_MODEL_ID } from '@/lib/llm'
import { DEFAULT_APP_SETTINGS, SettingsStore } from './store'

test('loads defaults when no settings file exists', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'micky-settings-'))
  const store = new SettingsStore(dir)
  const settings = await store.load()
  assert.equal(settings.activeModelId, DEFAULT_ASR_MODEL_ID)
  assert.equal(settings.wakeWordEnabled, true)
  assert.equal(settings.onboardingCompleted, false)
  assert.equal(settings.llm.modelId, DEFAULT_LLM_MODEL_ID)
  assert.deepEqual(settings.llm.customModelIds, [])
})

test('normalizes invalid persisted values on load', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'micky-settings-'))
  await writeFile(
    join(dir, 'settings.json'),
    JSON.stringify({
      activeModelId: 'not-a-model',
      wakeWordEnabled: 'yes',
      onboardingCompleted: 1,
      llm: { modelId: '  custom/model  ', customModelIds: ['', 'qwen/qwen3.7-flash', 'ok/model'] }
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
})

test('persists a patch to disk', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'micky-settings-'))
  const store = new SettingsStore(dir)
  await store.load()
  await store.update({ wakeWordEnabled: false, onboardingCompleted: true })
  const raw = JSON.parse(await readFile(join(dir, 'settings.json'), 'utf8')) as {
    wakeWordEnabled: boolean
    onboardingCompleted: boolean
  }
  assert.equal(raw.wakeWordEnabled, false)
  assert.equal(raw.onboardingCompleted, true)
})
