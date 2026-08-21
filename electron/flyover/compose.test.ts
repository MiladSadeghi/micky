import assert from 'node:assert/strict'
import test from 'node:test'
import { canAcceptFlyoverCompose, clampFlyoverDraft, shouldIgnoreFlyoverSpeech } from './compose'

test('clamps a typed flyover draft to the send cap', () => {
  assert.equal(clampFlyoverDraft('سلام').length, 4)
  assert.equal(clampFlyoverDraft('x'.repeat(5_000)).length, 4_000)
})

test('ignores speech only after typing has taken over the flyover', () => {
  assert.equal(shouldIgnoreFlyoverSpeech(false), false)
  assert.equal(shouldIgnoreFlyoverSpeech(true), true)
})

test('accepts typing on shortcut listen, follow-up reply, and an in-progress draft', () => {
  assert.equal(
    canAcceptFlyoverCompose({
      active: true,
      shortcutSession: true,
      phase: 'listening',
      canApprove: false
    }),
    true
  )
  assert.equal(
    canAcceptFlyoverCompose({
      active: true,
      shortcutSession: true,
      phase: 'reply',
      canApprove: false
    }),
    true
  )
  assert.equal(
    canAcceptFlyoverCompose({
      active: true,
      shortcutSession: true,
      phase: 'composing',
      canApprove: false
    }),
    true
  )
  assert.equal(
    canAcceptFlyoverCompose({
      active: true,
      shortcutSession: false,
      phase: 'listening',
      canApprove: false
    }),
    false
  )
  assert.equal(
    canAcceptFlyoverCompose({
      active: true,
      shortcutSession: true,
      phase: 'thinking',
      canApprove: false
    }),
    false
  )
  assert.equal(
    canAcceptFlyoverCompose({
      active: true,
      shortcutSession: true,
      phase: 'listening',
      canApprove: true
    }),
    false
  )
})
