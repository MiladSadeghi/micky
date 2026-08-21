import assert from 'node:assert/strict'
import test from 'node:test'
import { advanceReveal } from './typewriter'

test('reveals appended text a few characters at a time', () => {
  assert.equal(advanceReveal('', 'سلام'), 'س')
  assert.equal(advanceReveal('سلا', 'سلام'), 'سلام')
  assert.equal(advanceReveal('سلام', 'سلام'), 'سلام')
})

test('catches up faster on long text so a reply never lags behind', () => {
  const target = 'ا'.repeat(240)
  const first = advanceReveal('', target)
  assert.equal(first.length, 20)
  let shown = ''
  for (let i = 0; i < 60 && shown !== target; i++) shown = advanceReveal(shown, target)
  assert.equal(shown, target)
})

test('snaps back to the shared prefix when a transcript is rewritten', () => {
  assert.equal(advanceReveal('سلام چطوری', 'سلام چیکار'), 'سلام چی')
  assert.equal(advanceReveal('یک دو سه', 'یک دو'), 'یک دو')
  assert.equal(advanceReveal('abc', 'xyz'), 'x')
})

test('keeps surrogate pairs whole', () => {
  assert.equal(advanceReveal('', '👋🏽 hi'), '👋')
})
