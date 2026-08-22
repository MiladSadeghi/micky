import assert from 'node:assert/strict'
import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { BUNDLED_SKILL_SOURCE } from '@/lib/skills'
import { SettingsStore } from '../settings/store'
import { parseSkillFrontmatter, SkillService } from './service'

test('discovers app-bundled skills and enables them by default', async () => {
  const home = await mkdtemp(join(tmpdir(), 'micky-skills-'))
  const bundledRoot = join(home, 'app', 'assets', 'skills')
  const skillDirectory = join(bundledRoot, 'micky-app-guide')
  const installedSkillDirectory = join(home, '.agents', 'skills', 'alphabetical-first')
  await mkdir(skillDirectory, { recursive: true })
  await mkdir(installedSkillDirectory, { recursive: true })
  await writeFile(
    join(skillDirectory, 'SKILL.md'),
    '---\nname: micky-app-guide\ndescription: Explains how to configure and use Micky.\n---\n\nUse the guide.\n',
    'utf8'
  )
  await writeFile(
    join(installedSkillDirectory, 'SKILL.md'),
    '---\nname: alphabetical-first\ndescription: An installed skill that normally sorts first.\n---\n',
    'utf8'
  )

  const settings = new SettingsStore(join(home, 'app-data'))
  await settings.load()
  const service = new SkillService(settings, { home, bundledRoot })
  const snapshot = await service.refresh()

  assert.equal(snapshot.enabled, true)
  assert.equal(snapshot.skills.length, 2)
  assert.equal(snapshot.skills[0]?.name, 'micky-app-guide')
  assert.equal(snapshot.skills[0]?.source, BUNDLED_SKILL_SOURCE)
  assert.equal(snapshot.skills[0]?.enabled, true)
  assert.match((await service.load(snapshot.skills[0]!.id)).instructions, /Use the guide/)
})

test('discovers valid skills, deduplicates symlinks, and loads resources on demand', async () => {
  const home = await mkdtemp(join(tmpdir(), 'micky-skills-'))
  const sharedRoot = join(home, '.agents', 'skills')
  const codexRoot = join(home, '.codex', 'skills')
  const skillDirectory = join(sharedRoot, 'writing-helper')
  await mkdir(join(skillDirectory, 'references'), { recursive: true })
  await mkdir(join(sharedRoot, '.system', 'internal-skill'), { recursive: true })
  await mkdir(codexRoot, { recursive: true })
  await writeFile(
    join(skillDirectory, 'SKILL.md'),
    `---\nname: writing-helper\ndescription: >\n  Helps write concise\n  human prose.\n---\n\n# Instructions\n\nFollow the writing workflow.\n`,
    'utf8'
  )
  await writeFile(
    join(skillDirectory, 'references', 'tone.md'),
    'Prefer direct language.\n',
    'utf8'
  )
  await writeFile(
    join(sharedRoot, '.system', 'internal-skill', 'SKILL.md'),
    '---\nname: internal-skill\ndescription: Not a user-installed skill.\n---\n',
    'utf8'
  )
  await symlink(skillDirectory, join(codexRoot, 'writing-helper'))

  const settings = new SettingsStore(join(home, 'app-data'))
  await settings.load()
  const service = new SkillService(settings, {
    roots: [
      { path: sharedRoot, source: 'مشترک' },
      { path: codexRoot, source: 'Codex' }
    ]
  })
  const snapshot = await service.refresh()

  assert.equal(snapshot.skills.length, 1)
  assert.equal(snapshot.skills[0]?.name, 'writing-helper')
  assert.equal(snapshot.skills[0]?.description, 'Helps write concise human prose.')
  assert.equal(snapshot.skills[0]?.source, 'مشترک')
  assert.equal(snapshot.skills[0]?.hasResources, true)

  const id = snapshot.skills[0]!.id
  const loaded = await service.load(id)
  assert.match(loaded.instructions, /Follow the writing workflow/)
  assert.deepEqual(loaded.resources, ['references/tone.md'])

  const resource = await service.readResource(id, 'references/tone.md')
  assert.equal(resource.content, 'Prefer direct language.\n')
})

test('persists global and per-skill switches and blocks disabled loads', async () => {
  const home = await mkdtemp(join(tmpdir(), 'micky-skills-'))
  const root = join(home, 'skills')
  const skillDirectory = join(root, 'calendar-helper')
  await mkdir(skillDirectory, { recursive: true })
  await writeFile(
    join(skillDirectory, 'SKILL.md'),
    '---\nname: calendar-helper\ndescription: Helps plan a calendar.\n---\n\nUse dates carefully.\n',
    'utf8'
  )
  const settings = new SettingsStore(join(home, 'app-data'))
  await settings.load()
  const service = new SkillService(settings, { roots: [{ path: root, source: 'Test' }] })
  const id = (await service.refresh()).skills[0]!.id

  await service.setSkillEnabled(id, false)
  assert.equal(service.getSnapshot().skills[0]?.enabled, false)
  assert.deepEqual(service.getEnabledCatalog(), [])
  await assert.rejects(service.load(id), /unavailable or disabled/)

  await service.setSkillEnabled(id, true)
  await service.setEnabled(false)
  assert.equal(service.getSnapshot().enabled, false)
  assert.equal(service.getSnapshot().skills[0]?.enabled, true)
  assert.deepEqual(service.getEnabledCatalog(), [])
  await assert.rejects(service.load(id), /unavailable or disabled/)
})

test('skill resources cannot escape their skill directory', async () => {
  const home = await mkdtemp(join(tmpdir(), 'micky-skills-'))
  const root = join(home, 'skills')
  const skillDirectory = join(root, 'safe-skill')
  await mkdir(skillDirectory, { recursive: true })
  await writeFile(join(home, 'outside.txt'), 'private', 'utf8')
  await writeFile(
    join(skillDirectory, 'SKILL.md'),
    '---\nname: safe-skill\ndescription: A safe test skill.\n---\n\nUse the reference.\n',
    'utf8'
  )
  await symlink(join(home, 'outside.txt'), join(skillDirectory, 'outside.txt'))
  const settings = new SettingsStore(join(home, 'app-data'))
  await settings.load()
  const service = new SkillService(settings, { roots: [{ path: root, source: 'Test' }] })
  const id = (await service.refresh()).skills[0]!.id

  await assert.rejects(service.readResource(id, 'outside.txt'), /outside its directory/)
  await assert.rejects(service.readResource(id, '../outside.txt'), /outside its directory/)
})

test('frontmatter parser requires name and description and handles quotes', () => {
  assert.deepEqual(
    parseSkillFrontmatter('---\nname: "my-skill"\ndescription: \'A useful: skill\'\n---\nBody'),
    { name: 'my-skill', description: 'A useful: skill' }
  )
  assert.equal(parseSkillFrontmatter('---\nname: missing-description\n---\nBody'), null)
  assert.equal(parseSkillFrontmatter('# Not frontmatter'), null)
})
