import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_ASSISTANT_SHORTCUT,
  DEFAULT_DICTATION_SHORTCUT,
  type AppSettingsPatch
} from '@/lib/settings'
import type { SettingsStore } from '../settings/store'
import { ShortcutService, type ShortcutRegistry } from './service'

function harness(options?: { occupied?: string[]; failUpdate?: boolean }) {
  const registered = new Map<string, () => void>()
  const occupied = new Set(options?.occupied ?? [])
  let unregisterAllCalled = false
  const patches: AppSettingsPatch[] = []
  const registry: ShortcutRegistry = {
    register: (accelerator, callback) => {
      if (occupied.has(accelerator) || registered.has(accelerator)) return false
      registered.set(accelerator, callback)
      return true
    },
    unregister: (accelerator) => {
      registered.delete(accelerator)
    },
    unregisterAll: () => {
      unregisterAllCalled = true
      registered.clear()
    },
    isRegistered: (accelerator) => occupied.has(accelerator) || registered.has(accelerator)
  }
  const settings = {
    get: () => ({
      assistantShortcut: DEFAULT_ASSISTANT_SHORTCUT,
      dictationShortcut: DEFAULT_DICTATION_SHORTCUT
    }),
    update: async (patch: AppSettingsPatch) => {
      if (options?.failUpdate) throw new Error('disk failure')
      patches.push(patch)
      return {} as never
    }
  } as unknown as SettingsStore
  const errors: Array<string | null> = []
  const service = new ShortcutService({
    settings,
    registry,
    onAssistant: () => undefined,
    onDictation: () => undefined,
    onError: (error) => errors.push(error)
  })
  return {
    service,
    registered,
    patches,
    errors,
    wasUnregisterAllCalled: () => unregisterAllCalled
  }
}

test('registers defaults and releases all shortcuts on shutdown', () => {
  const state = harness()
  state.service.registerAll()
  assert.equal(state.registered.has(DEFAULT_ASSISTANT_SHORTCUT), true)
  assert.equal(state.registered.has(DEFAULT_DICTATION_SHORTCUT), true)
  state.service.unregisterAll()
  assert.equal(state.registered.size, 0)
  assert.equal(state.wasUnregisterAllCalled(), true)
})

test('preserves the previous shortcut when a replacement conflicts', async () => {
  const replacement = 'CommandOrControl+Alt+M'
  const state = harness({ occupied: [replacement] })
  state.service.registerAll()
  assert.equal(await state.service.replace('assistant', replacement), false)
  assert.equal(state.registered.has(DEFAULT_ASSISTANT_SHORTCUT), true)
  assert.equal(state.patches.length, 0)
  assert.match(state.errors.at(-1) ?? '', /میانبر قبلی/)
})

test('rolls registration back when persisting the replacement fails', async () => {
  const state = harness({ failUpdate: true })
  state.service.registerAll()
  await assert.rejects(() => state.service.replace('assistant', 'CommandOrControl+Alt+M'))
  assert.equal(state.registered.has(DEFAULT_ASSISTANT_SHORTCUT), true)
  assert.equal(state.registered.has('CommandOrControl+Alt+M'), false)
})
