import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeAsrOrthography, normalizeAsrTranscript } from './transcript-normalizer'

test('normalizes Persian character variants, diacritics, bidi marks, and whitespace', () => {
  assert.equal(normalizeAsrOrthography('  ‫كُدكس\n روي   دسكتاپ  '), 'کدکس روی دسکتاپ')
})

test('canonicalizes high-confidence AI and developer vocabulary', () => {
  assert.equal(
    normalizeAsrTranscript('چت جی پی دی رو با اوپن ای آی و ام سی پی به گیت هاب وصل کن'),
    'ChatGPT رو با OpenAI و MCP به GitHub وصل کن'
  )
  assert.equal(
    normalizeAsrTranscript('پروژه ری اکت و تایپ اسکریپت رو توی وی اس کود باز کن'),
    'پروژه React و TypeScript رو توی VS Code باز کن'
  )
})

test('repairs broken word boundaries for apps and system locations', () => {
  assert.equal(
    normalizeAsrTranscript('فایرفاکس رو باز کن و فایل رو روی دسک تاپ بذار'),
    'Firefox رو باز کن و فایل رو روی desktop بذار'
  )
  assert.equal(
    normalizeAsrTranscript('مک او اس و اسپات لایت و اکس کود'),
    'macOS و Spotlight و Xcode'
  )
})

test('canonicalizes existing Latin terms without changing surrounding punctuation', () => {
  assert.equal(normalizeAsrTranscript('chatgpt، github و next.js'), 'ChatGPT، GitHub و Next.js')
})

test('does not replace matches embedded inside longer words', () => {
  assert.equal(normalizeAsrTranscript('کرومیوم و رگ و راست'), 'کرومیوم و رگ و راست')
  assert.equal(normalizeAsrTranscript('supergithubproject'), 'supergithubproject')
})

test('keeps ordinary Persian untouched', () => {
  const text = 'لطفا فایل گزارش امروز را برای من پیدا کن'
  assert.equal(normalizeAsrTranscript(text), text)
  assert.equal(normalizeAsrTranscript('میکی جواب بده'), 'میکی جواب بده')
})
