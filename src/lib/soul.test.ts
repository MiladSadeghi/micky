import assert from 'node:assert/strict'
import test from 'node:test'
import { parseMarkdownDocument, parseUserFacts } from './soul'

test('parseMarkdownDocument turns headings and Markdown lines into a readable view', () => {
  assert.deepEqual(
    parseMarkdownDocument(
      '# Micky\n\nSpeak **warmly**.\n- Keep replies short.\n1. Remember what matters.\n',
      'شخصیت'
    ),
    {
      title: 'Micky',
      statements: ['Speak warmly.', 'Keep replies short.', 'Remember what matters.']
    }
  )
})

test('parseUserFacts reads populated profile rows and omits unknown values', () => {
  assert.deepEqual(parseUserFacts('# کاربر\n\n- نام: مانی\n- شهر: نامشخص\n- کار: برنامه‌نویس\n'), [
    { label: 'نام', value: 'مانی' },
    { label: 'کار', value: 'برنامه‌نویس' }
  ])
})

test('parseUserFacts supports English context files and omits Unknown values', () => {
  assert.deepEqual(
    parseUserFacts('# User Profile\n\n- Name: Mani\n- City: Unknown\n- Work: Developer\n'),
    [
      { label: 'Name', value: 'Mani' },
      { label: 'Work', value: 'Developer' }
    ]
  )
})
