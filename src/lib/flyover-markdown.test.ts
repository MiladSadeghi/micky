import assert from 'node:assert/strict'
import test from 'node:test'
import { hasRichMarkdown } from './flyover-markdown'

test('detects supported inline flyover markdown', () => {
  assert.equal(hasRichMarkdown('این بخش **مهم** است.'), true)
  assert.equal(hasRichMarkdown('این بخش *تأکید* دارد.'), true)
  assert.equal(hasRichMarkdown('See [the result](https://example.com).'), true)
  assert.equal(hasRichMarkdown('See https://example.com for details.'), true)
  assert.equal(hasRichMarkdown('Use `pnpm test`.'), true)
})

test('detects lists, headings, and tables', () => {
  assert.equal(hasRichMarkdown('## نتیجه'), true)
  assert.equal(hasRichMarkdown('- مورد اول\n- مورد دوم'), true)
  assert.equal(hasRichMarkdown('| نام | مقدار |\n| --- | --- |\n| یکی | ۱ |'), true)
})

test('leaves ordinary mixed-direction text on the plain path', () => {
  assert.equal(hasRichMarkdown('Done نتیجه آماده است.'), false)
  assert.equal(hasRichMarkdown('نسخه 1.2.3 آماده است.'), false)
})
