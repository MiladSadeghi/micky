import assert from 'node:assert/strict'
import test from 'node:test'
import { detectTextDirection } from './text-direction'

test('reads direction from the first strong character', () => {
  assert.equal(detectTextDirection('سلام میکی'), 'rtl')
  assert.equal(detectTextDirection('open my notes'), 'ltr')
  assert.equal(detectTextDirection('«سلام» hello'), 'rtl')
  assert.equal(detectTextDirection('"hello" سلام'), 'ltr')
})

test('keeps the fallback while the draft has no letters yet', () => {
  assert.equal(detectTextDirection(''), 'rtl')
  assert.equal(detectTextDirection('  ۱۲۳ …'), 'rtl')
  assert.equal(detectTextDirection('123', 'ltr'), 'ltr')
})
