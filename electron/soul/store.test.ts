import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { SoulStore, formatUserMarkdown } from './store'

test('new profile Markdown uses English structure and values', () => {
  const markdown = formatUserMarkdown({
    name: 'Mani',
    about: 'Building Micky and prefers practical help.',
    personalityProfile: 'thoughtful',
    addressForm: 'to',
    languageMix: 'mixed',
    city: 'Tehran',
    work: 'Developer',
    focus: 'Micky',
    replyLength: 'short'
  })
  assert.match(markdown, /^# User Profile/m)
  assert.match(markdown, /- Name: Mani/)
  assert.match(markdown, /- About: Building Micky and prefers practical help\./)
  assert.match(markdown, /- Personality profile: curious thinking partner/)
  assert.match(markdown, /- Address form: informal to/)
  assert.doesNotMatch(markdown, /نامشخص|# کاربر/)
})

test('initialization migrates legacy Persian templates and keeps saved facts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'micky-soul-'))
  const soulDir = join(root, 'soul')
  await mkdir(soulDir, { recursive: true })
  await writeFile(join(soulDir, 'SOUL.md'), '# Micky\n\nBe kind.\n', 'utf8')
  await writeFile(
    join(soulDir, 'USER.md'),
    '# کاربر\n\n- نام: مانی\n- شهر: تهران\n- طول پاسخ: خیلی کوتاه\n',
    'utf8'
  )
  await writeFile(
    join(soulDir, 'MEMORY.md'),
    '# حافظه\n\nحقایقی که میکی در طول گفتگو یاد گرفته، هر خط یک نکته پایدار.\n- چای دوست دارد.\n',
    'utf8'
  )

  const store = new SoulStore(root)
  await store.initialize()

  const user = await readFile(join(soulDir, 'USER.md'), 'utf8')
  const memory = await readFile(join(soulDir, 'MEMORY.md'), 'utf8')
  assert.match(user, /^# User Profile/m)
  assert.match(user, /- Name: مانی/)
  assert.match(user, /- City: تهران/)
  assert.match(user, /- Reply length: very short/)
  assert.match(memory, /^# Long-term Memory/m)
  assert.match(memory, /چای دوست دارد/)
})
