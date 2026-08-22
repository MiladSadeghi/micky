import assert from 'node:assert/strict'
import test from 'node:test'
import { getFlyoverLayout } from './flyover-layout'

test('keeps short flyover copy compact', () => {
  assert.equal(getFlyoverLayout('سلام، چه کاری برات انجام بدم؟'), 'compact')
})

test('expands the flyover in two steps as copy grows', () => {
  assert.equal(getFlyoverLayout('ا'.repeat(181)), 'expanded')
  assert.equal(getFlyoverLayout('ا'.repeat(461)), 'reading')
})

test('counts visible characters instead of UTF-16 code units', () => {
  assert.equal(getFlyoverLayout('🙂'.repeat(180)), 'compact')
  assert.equal(getFlyoverLayout('🙂'.repeat(181)), 'expanded')
})
