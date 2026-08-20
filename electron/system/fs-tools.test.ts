import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  listUserDirectory,
  readUserFile,
  searchInUserFiles,
  searchUserFiles,
  writeUserFile
} from './fs-tools'
import { PathDeniedError } from './paths'

async function fixtureHome(): Promise<string> {
  const home = await mkdtemp(join(tmpdir(), 'micky-fs-'))
  await mkdir(join(home, 'docs', 'nested'), { recursive: true })
  await mkdir(join(home, '.ssh'), { recursive: true })
  await writeFile(join(home, 'docs', 'readme.txt'), 'hello micky\nsecond line', 'utf8')
  await writeFile(join(home, 'docs', 'nested', 'todo.txt'), 'buy tea', 'utf8')
  await writeFile(join(home, 'docs', 'notes.md'), 'remember the tea', 'utf8')
  await writeFile(join(home, '.ssh', 'id_rsa'), 'secret-key', 'utf8')
  await writeFile(join(home, 'docs', 'long.txt'), 'x'.repeat(6_000), 'utf8')
  return home
}

test('reads a text file and caps long output', async () => {
  const home = await fixtureHome()
  const small = await readUserFile('~/docs/readme.txt', { home })
  assert.match(small.content, /hello micky/)
  assert.equal(small.truncated, false)

  const long = await readUserFile('~/docs/long.txt', { home })
  assert.equal(long.truncated, true)
  assert.ok(long.content.length <= 4_020)
  assert.match(long.content, /truncated/)
})

test('lists a directory without secret files leaking in', async () => {
  const home = await fixtureHome()
  const listing = await listUserDirectory('~/docs', { home })
  assert.ok(listing.entries.includes('readme.txt'))
  assert.ok(listing.entries.includes('nested/'))
  assert.ok(!listing.entries.some((entry) => entry.includes('id_rsa')))
})

test('finds files by name', async () => {
  const home = await fixtureHome()
  const result = await searchUserFiles('todo', '~', { home })
  assert.ok(result.matches.some((match) => match.includes('todo.txt')))
})

test('searches file contents as a literal string', async () => {
  const home = await fixtureHome()
  const result = await searchInUserFiles('tea', '~/docs', { home })
  assert.ok(result.hits.some((hit) => hit.includes('todo.txt')))
  assert.ok(result.hits.some((hit) => hit.includes('notes.md')))
  assert.ok(!result.hits.some((hit) => hit.toLowerCase().includes('id_rsa')))
})

test('creates, replaces, and appends UTF-8 text files', async () => {
  const home = await fixtureHome()
  const created = await writeUserFile('~/docs/result.csv', 'name,value\nMicky,1\n', 'create', {
    home
  })
  assert.equal(created.mode, 'create')
  assert.match((await readUserFile('~/docs/result.csv', { home })).content, /Micky,1/)

  await assert.rejects(
    () => writeUserFile('~/docs/result.csv', 'no', 'create', { home }),
    /already exists|از قبل وجود دارد/
  )
  await writeUserFile('~/docs/result.csv', 'first\n', 'overwrite', { home })
  await writeUserFile('~/docs/result.csv', 'second\n', 'append', { home })
  assert.equal((await readUserFile('~/docs/result.csv', { home })).content, 'first\nsecond\n')
})

test('file writes retain the existing protected-path policy', async () => {
  const home = await fixtureHome()
  await assert.rejects(
    () => writeUserFile('~/.env', 'TOKEN=nope', 'overwrite', { home }),
    PathDeniedError
  )
  await assert.rejects(
    () => writeUserFile('~/.ssh/new-key', 'secret', 'create', { home }),
    PathDeniedError
  )
})
