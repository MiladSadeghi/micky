import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSystemPrompt } from './prompt'

test('includes soul, user, memory, and a frozen clock', () => {
  const prompt = buildSystemPrompt({
    soul: 'Soul line.',
    user: 'User is Mani.',
    memory: 'Likes tea.',
    now: new Date('2026-08-19T18:00:00.000Z')
  })

  assert.match(prompt, /Soul line/)
  assert.match(prompt, /User is Mani/)
  assert.match(prompt, /Likes tea/)
  assert.match(prompt, /Local time:/)
  assert.match(prompt, /You are Micky/)
})

test('keeps the spoken-voice contract and skips empty user layers', () => {
  const prompt = buildSystemPrompt({
    soul: '',
    user: '   ',
    memory: '',
    now: new Date('2026-08-19T18:00:00.000Z')
  })

  assert.match(prompt, /No markdown/)
  assert.match(prompt, /short sentences/)
  assert.doesNotMatch(prompt, /^User$/m)
  assert.doesNotMatch(prompt, /^Memory$/m)
})
