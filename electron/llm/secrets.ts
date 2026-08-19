import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { safeStorage } from 'electron'

const SECRETS_FILE_NAME = 'secrets.json'

type SecretRecord = {
  v: 1
  encrypted: boolean
  payload: string
}

type SecretsFile = {
  openrouterApiKey?: SecretRecord
}

export class SecretStore {
  #path: string
  #apiKey: string | null = null
  #encryptionAvailable = false

  constructor(userDataPath: string) {
    this.#path = join(userDataPath, SECRETS_FILE_NAME)
  }

  get encryptionAvailable(): boolean {
    return this.#encryptionAvailable
  }

  getApiKey(): string | null {
    return this.#apiKey
  }

  hasApiKey(): boolean {
    return Boolean(this.#apiKey)
  }

  async load(): Promise<void> {
    this.#encryptionAvailable = safeStorage.isEncryptionAvailable()
    try {
      const raw = await readFile(this.#path, 'utf8')
      const parsed = JSON.parse(raw) as SecretsFile
      this.#apiKey = decodeSecret(parsed.openrouterApiKey, this.#encryptionAvailable)
    } catch {
      this.#apiKey = null
    }
  }

  async setApiKey(value: string): Promise<void> {
    const trimmed = value.trim()
    if (!trimmed) {
      await this.clearApiKey()
      return
    }
    this.#encryptionAvailable = safeStorage.isEncryptionAvailable()
    this.#apiKey = trimmed
    await this.#persist()
  }

  async clearApiKey(): Promise<void> {
    this.#apiKey = null
    await this.#persist()
  }

  async #persist(): Promise<void> {
    await mkdir(dirname(this.#path), { recursive: true })
    const file: SecretsFile = {}
    if (this.#apiKey) {
      file.openrouterApiKey = encodeSecret(this.#apiKey, this.#encryptionAvailable)
    }
    const tempPath = `${this.#path}.tmp`
    await writeFile(tempPath, `${JSON.stringify(file, null, 2)}\n`, 'utf8')
    await rename(tempPath, this.#path)
  }
}

function encodeSecret(value: string, encrypt: boolean): SecretRecord {
  if (encrypt) {
    return {
      v: 1,
      encrypted: true,
      payload: safeStorage.encryptString(value).toString('base64')
    }
  }
  return { v: 1, encrypted: false, payload: value }
}

function decodeSecret(
  record: SecretRecord | undefined,
  encryptionAvailable: boolean
): string | null {
  if (!record || typeof record.payload !== 'string' || !record.payload) return null
  if (!record.encrypted) return record.payload
  if (!encryptionAvailable) return null
  try {
    return safeStorage.decryptString(Buffer.from(record.payload, 'base64'))
  } catch {
    return null
  }
}
