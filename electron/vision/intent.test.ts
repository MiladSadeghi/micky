import assert from 'node:assert/strict'
import test from 'node:test'
import { hasExplicitScreenIntent } from './intent'

test('accepts explicit Persian and English screen requests', () => {
  assert.equal(hasExplicitScreenIntent('به صفحه نگاه کن و بگو چی می‌بینی'), true)
  assert.equal(hasExplicitScreenIntent('این اسکرین رو توضیح بده'), true)
  assert.equal(hasExplicitScreenIntent('بگو روی صفحه چی هست'), true)
  assert.equal(hasExplicitScreenIntent('look at my screen and explain this'), true)
  assert.equal(hasExplicitScreenIntent('الان چی می‌بینی؟'), true)
  assert.equal(hasExplicitScreenIntent('میشه اینو ببینی و بگی مشکلش چیه'), true)
  assert.equal(hasExplicitScreenIntent('این رو ببین'), true)
  assert.equal(hasExplicitScreenIntent('what do you see now?'), true)
})

test('rejects screen mentions without an explicit request to look', () => {
  assert.equal(hasExplicitScreenIntent('صفحه من بزرگ است'), false)
  assert.equal(hasExplicitScreenIntent('این را برایم توضیح بده'), false)
  assert.equal(hasExplicitScreenIntent('یک اسکرین‌شات ذخیره کن'), false)
})
