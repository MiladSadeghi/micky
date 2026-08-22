import assert from 'node:assert/strict'
import test from 'node:test'
import { hasSpokenText } from './conversation'

test('rejects empty, punctuation-only, and one-character ASR blips', () => {
  for (const text of ['', '   ', '...', '؟!', 'ا', 'ا.', '\ufffd']) {
    assert.equal(hasSpokenText(text), false, JSON.stringify(text))
  }
})

test('accepts short meaningful speech', () => {
  for (const text of ['نه', 'بله', 'stop', '۲۵']) {
    assert.equal(hasSpokenText(text), true, JSON.stringify(text))
  }
})
