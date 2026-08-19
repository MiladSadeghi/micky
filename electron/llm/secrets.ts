import { readFile, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(import.meta.url)

const LEGACY_SECRETS_FILE_NAME = 'secrets.json'
const KEYCHAIN_SERVICE = 'dev.micky.app'
const KEYCHAIN_ACCOUNT = 'openrouter'

export const KEYCHAIN_UNAVAILABLE_ERROR =
  'کی‌چین سیستم در دسترس نیست. روی لینوکس GNOME Keyring یا KWallet لازم است.'

export type KeychainBackend = {
  getPassword: (service: string, account: string) => string | null
  setPassword: (service: string, account: string, password: string) => void
  deletePassword: (service: string, account: string) => boolean
}

type SecretRecord = {
  v: 1
  encrypted: boolean
  payload: string
}

type SecretsFile = {
  openrouterApiKey?: SecretRecord
}

type SecretStoreOptions = {
  backend?: KeychainBackend
}

export class SecretStore {
  #legacyPath: string
  #backend: KeychainBackend | null
  #apiKey: string | null = null
  #keychainAvailable = false

  constructor(userDataPath: string, options: SecretStoreOptions = {}) {
    this.#legacyPath = join(userDataPath, LEGACY_SECRETS_FILE_NAME)
    this.#backend = options.backend ?? createOsKeychain()
  }

  get keychainAvailable(): boolean {
    return this.#keychainAvailable
  }

  getApiKey(): string | null {
    return this.#apiKey
  }

  hasApiKey(): boolean {
    return Boolean(this.#apiKey)
  }

  async load(): Promise<void> {
    this.#keychainAvailable = probeKeychain(this.#backend)
    this.#apiKey = this.#keychainAvailable ? this.#readKeychain() : null

    if (this.#apiKey) {
      await this.#deleteLegacyFile()
      return
    }

    const legacy = await this.#readLegacyFile()
    if (!legacy) return

    this.#apiKey = legacy
    if (!this.#keychainAvailable || !this.#backend) return

    this.#backend.setPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, legacy)
    await this.#deleteLegacyFile()
  }

  async setApiKey(value: string): Promise<void> {
    const trimmed = value.trim()
    if (!trimmed) {
      await this.clearApiKey()
      return
    }
    if (!this.#backend || !this.#keychainAvailable) {
      throw new Error(KEYCHAIN_UNAVAILABLE_ERROR)
    }
    this.#backend.setPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, trimmed)
    this.#apiKey = trimmed
    await this.#deleteLegacyFile()
  }

  async clearApiKey(): Promise<void> {
    this.#apiKey = null
    if (this.#backend && this.#keychainAvailable) {
      this.#backend.deletePassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT)
    }
    await this.#deleteLegacyFile()
  }

  #readKeychain(): string | null {
    if (!this.#backend) return null
    try {
      const value = this.#backend.getPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT)
      return value?.trim() ? value : null
    } catch {
      return null
    }
  }

  async #readLegacyFile(): Promise<string | null> {
    try {
      const raw = await readFile(this.#legacyPath, 'utf8')
      const parsed = JSON.parse(raw) as SecretsFile
      return decodeLegacySecret(parsed.openrouterApiKey)
    } catch {
      return null
    }
  }

  async #deleteLegacyFile(): Promise<void> {
    await rm(this.#legacyPath, { force: true })
  }
}

function createOsKeychain(): KeychainBackend | null {
  try {
    const { Entry } = require('@napi-rs/keyring') as typeof import('@napi-rs/keyring')
    return {
      getPassword(service, account) {
        return new Entry(service, account).getPassword()
      },
      setPassword(service, account, password) {
        new Entry(service, account).setPassword(password)
      },
      deletePassword(service, account) {
        try {
          return new Entry(service, account).deletePassword()
        } catch {
          return false
        }
      }
    }
  } catch {
    return null
  }
}

function probeKeychain(backend: KeychainBackend | null): boolean {
  if (!backend) return false
  try {
    backend.getPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT)
    return true
  } catch {
    return false
  }
}

function decodeLegacySecret(record: SecretRecord | undefined): string | null {
  if (!record || typeof record.payload !== 'string' || !record.payload) return null
  if (!record.encrypted) return record.payload
  return decryptLegacyPayload(record.payload)
}

function decryptLegacyPayload(payload: string): string | null {
  try {
    const { safeStorage } = require('electron') as typeof import('electron')
    if (!safeStorage.isEncryptionAvailable()) return null
    return safeStorage.decryptString(Buffer.from(payload, 'base64'))
  } catch {
    return null
  }
}
