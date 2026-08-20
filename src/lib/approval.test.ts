import assert from 'node:assert/strict'
import test from 'node:test'
import { interpretApproval } from './approval'

test('treats messy spoken yes as approval', () => {
  assert.equal(interpretApproval('آره'), 'yes')
  assert.equal(interpretApproval('باشه بزن'), 'yes')
  assert.equal(interpretApproval('بله حتما'), 'yes')
  assert.equal(interpretApproval('اوکی'), 'yes')
  assert.equal(interpretApproval('ok'), 'yes')
})

test('treats spoken no as a denial', () => {
  assert.equal(interpretApproval('نه'), 'no')
  assert.equal(interpretApproval('نکن'), 'no')
  assert.equal(interpretApproval('ولش کن'), 'no')
  assert.equal(interpretApproval('بیخیال'), 'no')
})

test('fails closed on mixed approval and waits again on unrelated speech', () => {
  assert.equal(interpretApproval('آره نه'), 'no')
  assert.equal(interpretApproval('ساعت چنده'), 'unknown')
  assert.equal(interpretApproval(''), 'unknown')
  assert.equal(interpretApproval('...'), 'unknown')
})
