import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assistantShortcutAction,
  mainWindowFocusAction,
  shouldInterruptForWakeWordResume,
  shouldShowWakeFlyover
} from './activation'

const WAKE_ACTIVATION = {
  source: 'wake-word',
  confidence: 0.9,
  detectedAt: 1
} as const

test('shows the flyover for a background wake-word activation', () => {
  assert.equal(shouldShowWakeFlyover(WAKE_ACTIVATION, false), true)
  assert.equal(shouldShowWakeFlyover(WAKE_ACTIVATION, true), false)
})

test('does not show the background flyover for manual orb activation', () => {
  assert.equal(shouldShowWakeFlyover({ ...WAKE_ACTIVATION, source: 'manual' }, false), false)
})

test('wake-word mute does not interrupt an ongoing conversation flow', () => {
  assert.equal(shouldInterruptForWakeWordResume('idle'), true)
  assert.equal(shouldInterruptForWakeWordResume('agent'), false)
  assert.equal(shouldInterruptForWakeWordResume('confirm'), false)
  assert.equal(shouldInterruptForWakeWordResume('followup'), false)
})

test('reveals a main-window task instead of starting a new shortcut session', () => {
  assert.equal(
    assistantShortcutAction({
      flyoverActive: false,
      flyoverVisible: false,
      flyoverMirroring: false,
      conversationMode: 'agent',
      speechActive: false,
      dictationActive: false
    }),
    'reveal-ongoing'
  )
  assert.equal(
    assistantShortcutAction({
      flyoverActive: false,
      flyoverVisible: false,
      flyoverMirroring: false,
      conversationMode: 'idle',
      speechActive: true,
      dictationActive: false
    }),
    'reveal-ongoing'
  )
})

test('hides a mirrored task without stopping its main-window session', () => {
  assert.equal(
    assistantShortcutAction({
      flyoverActive: true,
      flyoverVisible: true,
      flyoverMirroring: true,
      conversationMode: 'agent',
      speechActive: false,
      dictationActive: false
    }),
    'hide-mirror'
  )
})

test('conceals an active flyover task instead of stopping the agent', () => {
  for (const conversationMode of ['agent', 'confirm'] as const) {
    assert.equal(
      assistantShortcutAction({
        flyoverActive: true,
        flyoverVisible: true,
        flyoverMirroring: false,
        conversationMode,
        speechActive: false,
        dictationActive: false
      }),
      'hide-ongoing'
    )
  }
})

test('stops followup listening when hiding a finished flyover', () => {
  for (const flyoverMirroring of [false, true]) {
    assert.equal(
      assistantShortcutAction({
        flyoverActive: true,
        flyoverVisible: true,
        flyoverMirroring,
        conversationMode: 'followup',
        speechActive: true,
        dictationActive: false
      }),
      'stop-session'
    )
  }
})

test('still stops a flyover that is only listening for a new request', () => {
  assert.equal(
    assistantShortcutAction({
      flyoverActive: true,
      flyoverVisible: true,
      flyoverMirroring: false,
      conversationMode: 'idle',
      speechActive: true,
      dictationActive: false
    }),
    'stop-session'
  )
})

test('reveals a concealed flyover task on the next shortcut press', () => {
  assert.equal(
    assistantShortcutAction({
      flyoverActive: true,
      flyoverVisible: false,
      flyoverMirroring: false,
      conversationMode: 'agent',
      speechActive: false,
      dictationActive: false
    }),
    'reveal-ongoing'
  )
})

test('starts a new assistant session when only dictation is active', () => {
  assert.equal(
    assistantShortcutAction({
      flyoverActive: false,
      flyoverVisible: false,
      flyoverMirroring: false,
      conversationMode: 'idle',
      speechActive: true,
      dictationActive: true
    }),
    'start-session'
  )
})

test('detaches a visible assistant flyover when the main window gains focus', () => {
  assert.equal(
    mainWindowFocusAction({
      flyoverVisible: true,
      assistantActive: true,
      assistantComposing: false
    }),
    'detach-assistant'
  )
  assert.equal(
    mainWindowFocusAction({
      flyoverVisible: true,
      assistantActive: false,
      assistantComposing: false
    }),
    'hide'
  )
})

test('cancels an abandoned flyover draft when focus moves to the main window', () => {
  assert.equal(
    mainWindowFocusAction({
      flyoverVisible: true,
      assistantActive: true,
      assistantComposing: true
    }),
    'cancel-compose'
  )
})
