import assert from 'node:assert/strict'
import test from 'node:test'
import { transcriptWindow } from './transcript-window'

test('keeps the newest live transcript words within a fixed window', () => {
  const window = transcriptWindow('یک دو سه چهار پنج شش', 4)

  assert.deepEqual(window.words, ['سه', 'چهار', 'پنج', 'شش'])
  assert.equal(window.startIndex, 2)
  assert.equal(window.totalWords, 6)
  assert.equal(window.truncated, true)
})

test('keeps short transcripts intact', () => {
  const window = transcriptWindow('سلام میکی', 4)

  assert.deepEqual(window.words, ['سلام', 'میکی'])
  assert.equal(window.startIndex, 0)
  assert.equal(window.truncated, false)
})
