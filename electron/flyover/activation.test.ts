import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldShowWakeFlyover } from './activation'

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
