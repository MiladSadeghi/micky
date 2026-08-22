import assert from 'node:assert/strict'
import test from 'node:test'
import { detectTextDirection } from './text-direction'

test('uses the dominant writing direction across the whole text', () => {
  assert.equal(detectTextDirection('سلام میکی'), 'rtl')
  assert.equal(detectTextDirection('open my notes'), 'ltr')
  assert.equal(detectTextDirection('ChatGPT پاسخ کامل فارسی را اینجا می‌دهد'), 'rtl')
  assert.equal(detectTextDirection('سلام this answer is mostly written in English'), 'ltr')
})

test('treats a URL or product name as one directional word', () => {
  assert.equal(detectTextDirection('https://example.com/docs راهنمای کامل اینجاست'), 'rtl')
  assert.equal(detectTextDirection('OpenAI API رو باز کن'), 'rtl')
})

test('keeps the fallback while the draft has no letters yet', () => {
  assert.equal(detectTextDirection(''), 'rtl')
  assert.equal(detectTextDirection('  ۱۲۳ …'), 'rtl')
  assert.equal(detectTextDirection('123', 'ltr'), 'ltr')
})
