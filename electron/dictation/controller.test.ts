import assert from 'node:assert/strict'
import test from 'node:test'
import type { FlyoverService } from '../flyover/service'
import type { LlmService } from '../llm/service'
import type { SettingsStore } from '../settings/store'
import type { SpeechService } from '../speech/service'
import type { WakeWordService } from '../wake-word/service'
import type { PasteService } from '../system/paste'
import { DictationController } from './controller'

function createHarness(options?: { aiCleanup?: boolean; configured?: boolean }) {
  let speechStarts = 0
  let speechFinishes = 0
  let speechCancels = 0
  let clipboardText = ''
  const snapshots: Array<Record<string, unknown>> = []
  const settings = {
    get: () => ({
      dictationAiCleanup: options?.aiCleanup ?? false,
      dictationAutoPaste: false
    })
  } as unknown as SettingsStore
  const speech = {
    startSession: async () => {
      speechStarts += 1
    },
    finishSession: () => {
      speechFinishes += 1
    },
    cancelSession: () => {
      speechCancels += 1
    },
    getStatus: () => ({ phase: 'listening' })
  } as unknown as SpeechService
  const flyover = {
    show: (snapshot: Record<string, unknown>) => {
      snapshots.push(snapshot)
      return snapshot
    },
    update: (snapshot: Record<string, unknown>) => {
      snapshots.push(snapshot)
      return snapshot
    },
    hide: () => undefined
  } as unknown as FlyoverService
  const controller = new DictationController({
    settings,
    llm: {
      isConfigured: () => options?.configured ?? false
    } as unknown as LlmService,
    getSpeech: () => speech,
    getWakeWord: () =>
      ({
        beginExternalSession: () => undefined,
        endExternalSession: () => undefined
      }) as unknown as WakeWordService,
    flyover,
    paste: {
      captureForeground: async () => ({ platform: process.platform, value: null }),
      paste: async () => false
    } as PasteService,
    writeClipboard: (text) => {
      clipboardText = text
    },
    refine: async (text) => `${text}!`,
    interruptAssistant: () => undefined
  })

  return {
    controller,
    snapshots,
    get speechStarts() {
      return speechStarts
    },
    get speechFinishes() {
      return speechFinishes
    },
    get speechCancels() {
      return speechCancels
    },
    get clipboardText() {
      return clipboardText
    }
  }
}

test('pressing the dictation shortcut again finishes the active recording', async () => {
  const harness = createHarness()

  await harness.controller.toggle()
  await harness.controller.toggle()

  assert.equal(harness.speechStarts, 1)
  assert.equal(harness.speechFinishes, 1)
  assert.equal(harness.speechCancels, 1)
  assert.equal(harness.snapshots.at(-1)?.text, 'دارم گفتارت رو نهایی می‌کنم…')

  await harness.controller.toggle()
  assert.equal(harness.speechStarts, 1)
  assert.equal(harness.speechCancels, 1)
})

test('flyover names AI refinement while dictation is being cleaned', async () => {
  const harness = createHarness({ aiCleanup: true, configured: true })

  await harness.controller.toggle()
  assert.match(String(harness.snapshots.at(-1)?.hint), /هوش مصنوعی/)

  await harness.controller.onFinal('سلام دنیا')

  const refining = harness.snapshots.find((snapshot) => snapshot.title === 'اصلاح با هوش مصنوعی')
  assert.equal(refining?.phase, 'cleaning')
  assert.equal(refining?.text, 'دارم متن رو تمیز می‌کنم…')
  assert.equal(harness.clipboardText, 'سلام دنیا!')
})
