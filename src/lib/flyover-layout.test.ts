import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getFlyoverComposeLayout,
  getFlyoverContentLayout,
  getFlyoverLayout
} from './flyover-layout'

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

test('widens immediately for Markdown tables and fenced code', () => {
  assert.equal(getFlyoverLayout('| نام | مقدار |\n| --- | --- |\n| سرعت | خوب |'), 'wide')
  assert.equal(getFlyoverLayout('```ts\nconst ready = true\n```'), 'wide')
})

test('adds height when structured content has many rows', () => {
  const table = [
    '| نام | مقدار |',
    '| --- | --- |',
    ...Array.from({ length: 8 }, (_, index) => `| مورد ${index + 1} | ${index + 1} |`)
  ].join('\n')

  assert.equal(getFlyoverLayout(table), 'wide-reading')
})

test('expands multi-item lists even when their character count is short', () => {
  assert.equal(getFlyoverLayout('- یک\n- دو\n- سه'), 'expanded')
})

test('sizes the flyover from a live composer draft as well as response copy', () => {
  assert.equal(getFlyoverContentLayout({ text: 'بنویس…', composeText: 'ا'.repeat(73) }), 'expanded')
  assert.equal(getFlyoverContentLayout({ text: 'بنویس…', composeText: 'ا'.repeat(281) }), 'reading')
})

test('keeps the composer compact for two short lines and expands on the third', () => {
  assert.equal(getFlyoverComposeLayout('خط اول\nخط دوم'), 'compact')
  assert.equal(getFlyoverComposeLayout('خط اول\nخط دوم\nخط سوم'), 'expanded')
})

test('widens the flyover for the long Persian task from the composer', () => {
  const task =
    'میشه بری تو سایت nimruz.site ببینی چیکار میکنن دقیقا وقتی متوجه شدی کامل یه فایل MD داخل دسکتاپ ام بساز بعدش بازش کن برام روی مانیتور دوم ام'

  assert.equal(getFlyoverComposeLayout(task), 'expanded')
  assert.equal(
    getFlyoverContentLayout({ text: 'حرف بزن یا بنویس…', composeText: task }),
    'expanded'
  )
})
