import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { KEYCHAIN_UNAVAILABLE_ERROR, SecretStore, type KeychainBackend } from './secrets'

test('loads an existing keychain entry', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'micky-secrets-'))
  const backend = memoryKeychain()
  backend.setPassword('dev.micky.app', 'openrouter', 'sk-or-existing')

  const store = new SecretStore(dir, { backend })
  await store.load()

  assert.equal(store.keychainAvailable, true)
  assert.equal(store.getApiKey(), 'sk-or-existing')
})

test('stores the API key in the OS keychain backend', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'micky-secrets-'))
  const backend = memoryKeychain()
  const store = new SecretStore(dir, { backend })

  await store.load()
  await store.setApiKey('  sk-or-test  ')

  assert.equal(store.hasApiKey(), true)
  assert.equal(store.getApiKey(), 'sk-or-test')
  assert.equal(backend.getPassword('dev.micky.app', 'openrouter'), 'sk-or-test')
})

test('clears the keychain entry', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'micky-secrets-'))
  const backend = memoryKeychain()
  const store = new SecretStore(dir, { backend })

  await store.load()
  await store.setApiKey('sk-or-test')
  await store.clearApiKey()

  assert.equal(store.hasApiKey(), false)
  assert.equal(store.getApiKey(), null)
  assert.equal(backend.getPassword('dev.micky.app', 'openrouter'), null)
})

test('stores independent Gemini and ElevenLabs TTS keys', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'micky-secrets-'))
  const backend = memoryKeychain()
  const store = new SecretStore(dir, { backend })
  await store.load()

  await store.setTtsApiKey('gemini', 'gemini-key')
  await store.setTtsApiKey('elevenlabs', 'eleven-key')

  assert.equal(store.getTtsApiKey('gemini'), 'gemini-key')
  assert.equal(store.getTtsApiKey('elevenlabs'), 'eleven-key')
  assert.equal(backend.getPassword('dev.micky.app', 'gemini-tts'), 'gemini-key')
  assert.equal(backend.getPassword('dev.micky.app', 'elevenlabs-tts'), 'eleven-key')

  await store.clearTtsApiKey('gemini')
  assert.equal(store.hasTtsApiKey('gemini'), false)
  assert.equal(store.hasTtsApiKey('elevenlabs'), true)
})

test('stores independent Exa and Firecrawl search keys', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'micky-secrets-'))
  const backend = memoryKeychain()
  const store = new SecretStore(dir, { backend })
  await store.load()

  await store.setWebSearchApiKey('exa', 'exa-key')
  await store.setWebSearchApiKey('firecrawl', 'fc-key')

  assert.equal(store.getWebSearchApiKey('exa'), 'exa-key')
  assert.equal(store.getWebSearchApiKey('firecrawl'), 'fc-key')
  assert.equal(backend.getPassword('dev.micky.app', 'exa-search'), 'exa-key')
  assert.equal(backend.getPassword('dev.micky.app', 'firecrawl-search'), 'fc-key')

  await store.clearWebSearchApiKey('exa')
  assert.equal(store.hasWebSearchApiKey('exa'), false)
  assert.equal(store.hasWebSearchApiKey('firecrawl'), true)
})

test('stores independent keys for OpenRouter and compatible LLM providers', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'micky-secrets-'))
  const backend = memoryKeychain()
  const store = new SecretStore(dir, { backend })
  await store.load()

  await store.setApiKey('openrouter', 'openrouter-key')
  await store.setApiKey('custom', 'custom-key')
  await store.setApiKey('lmstudio', 'studio-key')

  assert.equal(store.getApiKey('openrouter'), 'openrouter-key')
  assert.equal(store.getApiKey('custom'), 'custom-key')
  assert.equal(store.getApiKey('lmstudio'), 'studio-key')
  assert.equal(backend.getPassword('dev.micky.app', 'custom-llm'), 'custom-key')
  assert.equal(backend.getPassword('dev.micky.app', 'lmstudio-llm'), 'studio-key')
})

test('migrates a plaintext secrets.json file into the keychain and deletes it', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'micky-secrets-'))
  const secretsPath = join(dir, 'secrets.json')
  await writeFile(
    secretsPath,
    JSON.stringify({
      openrouterApiKey: { v: 1, encrypted: false, payload: 'sk-or-legacy' }
    }),
    'utf8'
  )

  const backend = memoryKeychain()
  const store = new SecretStore(dir, { backend })
  await store.load()

  assert.equal(store.getApiKey(), 'sk-or-legacy')
  assert.equal(backend.getPassword('dev.micky.app', 'openrouter'), 'sk-or-legacy')
  await assert.rejects(readFile(secretsPath, 'utf8'), { code: 'ENOENT' })
})

test('does not treat an encrypted leftover file as a plaintext key', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'micky-secrets-'))
  await writeFile(
    join(dir, 'secrets.json'),
    JSON.stringify({
      openrouterApiKey: { v: 1, encrypted: true, payload: 'not-a-real-key' }
    }),
    'utf8'
  )

  const store = new SecretStore(dir, { backend: memoryKeychain() })
  await store.load()

  assert.equal(store.getApiKey(), null)
})

test('refuses to save when the OS keychain is unavailable', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'micky-secrets-'))
  const store = new SecretStore(dir, { backend: unavailableKeychain() })
  await store.load()

  assert.equal(store.keychainAvailable, false)
  await assert.rejects(store.setApiKey('sk-or-test'), {
    message: KEYCHAIN_UNAVAILABLE_ERROR
  })
  assert.equal(store.getApiKey(), null)
})

test('keeps a legacy key in memory when keychain is down and leaves the file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'micky-secrets-'))
  const secretsPath = join(dir, 'secrets.json')
  await writeFile(
    secretsPath,
    JSON.stringify({
      openrouterApiKey: { v: 1, encrypted: false, payload: 'sk-or-legacy' }
    }),
    'utf8'
  )

  const store = new SecretStore(dir, { backend: unavailableKeychain() })
  await store.load()

  assert.equal(store.getApiKey(), 'sk-or-legacy')
  assert.equal(
    JSON.parse(await readFile(secretsPath, 'utf8')).openrouterApiKey.payload,
    'sk-or-legacy'
  )
})

function memoryKeychain(): KeychainBackend {
  const store = new Map<string, string>()
  const id = (service: string, account: string): string => `${service}\0${account}`
  return {
    getPassword(service, account) {
      return store.get(id(service, account)) ?? null
    },
    setPassword(service, account, password) {
      store.set(id(service, account), password)
    },
    deletePassword(service, account) {
      return store.delete(id(service, account))
    }
  }
}

function unavailableKeychain(): KeychainBackend {
  const fail = (): never => {
    throw new Error('The name org.freedesktop.secrets was not provided')
  }
  return {
    getPassword: fail,
    setPassword: fail,
    deletePassword: () => false
  }
}
