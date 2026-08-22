import assert from 'node:assert/strict'
import test from 'node:test'
import { hasFlyoverMarkdown } from './flyover-markdown'

test('detects supported inline flyover markdown', () => {
  assert.equal(hasFlyoverMarkdown('این بخش **مهم** است.'), true)
  assert.equal(hasFlyoverMarkdown('این بخش *تأکید* دارد.'), true)
  assert.equal(hasFlyoverMarkdown('See [the result](https://example.com).'), true)
  assert.equal(hasFlyoverMarkdown('See https://example.com for details.'), true)
  assert.equal(hasFlyoverMarkdown('Use `pnpm test`.'), true)
})

test('detects lists, headings, and tables', () => {
  assert.equal(hasFlyoverMarkdown('## نتیجه'), true)
  assert.equal(hasFlyoverMarkdown('- مورد اول\n- مورد دوم'), true)
  assert.equal(hasFlyoverMarkdown('| نام | مقدار |\n| --- | --- |\n| یکی | ۱ |'), true)
})

test('leaves ordinary mixed-direction text on the plain path', () => {
  assert.equal(hasFlyoverMarkdown('Done نتیجه آماده است.'), false)
  assert.equal(hasFlyoverMarkdown('نسخه 1.2.3 آماده است.'), false)
})
