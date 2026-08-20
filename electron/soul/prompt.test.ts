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
  assert.match(prompt, /end_conversation/)
  assert.match(prompt, /run_command/)
  assert.match(prompt, /user's computer/)
  assert.match(prompt, /look_at_screen/)
  assert.match(prompt, /write_file/)
  assert.match(prompt, /fetch_webpage/)
  assert.match(prompt, /edit_personal_context/)
  assert.match(prompt, /living context/)
  assert.match(prompt, /search_chats/)
  assert.match(prompt, /read_chat/)
  assert.doesNotMatch(prompt, /^User$/m)
  assert.doesNotMatch(prompt, /^Memory$/m)
})

test('adds only skill metadata and progressive loading guidance', () => {
  const prompt = buildSystemPrompt(
    { soul: '', user: '', memory: '', now: new Date('2026-08-19T18:00:00.000Z') },
    [
      {
        id: 'skill-1',
        name: 'writing-helper',
        description: 'Use for <careful> writing.',
        source: 'مشترک',
        enabled: true,
        hasResources: false
      }
    ]
  )

  assert.match(prompt, /load_skill/)
  assert.match(prompt, /read_skill_resource/)
  assert.match(prompt, /id="skill-1"/)
  assert.match(prompt, /writing-helper/)
  assert.match(prompt, /&lt;careful&gt;/)
  assert.match(prompt, /load the smallest sufficient set/)
})
