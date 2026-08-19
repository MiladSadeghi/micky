import assert from 'node:assert/strict'
import test from 'node:test'
import { isWakeWordAudioPayload, WAKE_WORD_SAMPLE_RATE } from './wake-word'

test('accepts bounded float PCM payloads', () => {
  assert.equal(isWakeWordAudioPayload(new Float32Array(1_280).buffer), true)
  assert.equal(isWakeWordAudioPayload(new ArrayBuffer(0)), false)
  assert.equal(isWakeWordAudioPayload(new ArrayBuffer(3)), false)
  assert.equal(
    isWakeWordAudioPayload(new Float32Array(WAKE_WORD_SAMPLE_RATE + 1).buffer),
    false
  )
})
