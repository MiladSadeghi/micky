import { readFile, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import type { LlmProviderId } from '@/lib/llm'

const require = createRequire(import.meta.url)

const LEGACY_SECRETS_FILE_NAME = 'secrets.json'
const KEYCHAIN_SERVICE = 'dev.micky.app'
type SecretAccount =
  'openrouter' | 'custom-llm' | 'ollama-llm' | 'lmstudio-llm' | 'gemini-tts' | 'elevenlabs-tts'
type TtsSecretProvider = 'gemini' | 'elevenlabs'

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
  #keys: Record<SecretAccount, string | null> = {
    openrouter: null,
    'custom-llm': null,
    'ollama-llm': null,
    'lmstudio-llm': null,
    'gemini-tts': null,
    'elevenlabs-tts': null
  }
  #keychainAvailable = false

  constructor(userDataPath: string, options: SecretStoreOptions = {}) {
    this.#legacyPath = join(userDataPath, LEGACY_SECRETS_FILE_NAME)
    this.#backend = options.backend ?? createOsKeychain()
  }

  get keychainAvailable(): boolean {
    return this.#keychainAvailable
  }

  getApiKey(provider: LlmProviderId = 'openrouter'): string | null {
    return this.#keys[llmAccount(provider)]
  }

  hasApiKey(provider: LlmProviderId = 'openrouter'): boolean {
    return Boolean(this.getApiKey(provider))
  }

  getTtsApiKey(provider: TtsSecretProvider): string | null {
    return this.#keys[ttsAccount(provider)]
  }

  hasTtsApiKey(provider: TtsSecretProvider): boolean {
    return Boolean(this.getTtsApiKey(provider))
  }

  async load(): Promise<void> {
    this.#keychainAvailable = probeKeychain(this.#backend)
    if (this.#keychainAvailable) {
      for (const account of secretAccounts()) this.#keys[account] = this.#readKeychain(account)
    }

    if (this.#keys.openrouter) {
      await this.#deleteLegacyFile()
      return
    }

    const legacy = await this.#readLegacyFile()
    if (!legacy) return

    this.#keys.openrouter = legacy
    if (!this.#keychainAvailable || !this.#backend) return

    this.#backend.setPassword(KEYCHAIN_SERVICE, 'openrouter', legacy)
    await this.#deleteLegacyFile()
  }

  async setApiKey(value: string): Promise<void>
  async setApiKey(provider: LlmProviderId, value: string): Promise<void>
  async setApiKey(providerOrValue: LlmProviderId | string, maybeValue?: string): Promise<void> {
    const provider = maybeValue === undefined ? 'openrouter' : (providerOrValue as LlmProviderId)
    const value = maybeValue === undefined ? providerOrValue : maybeValue
    const account = llmAccount(provider)
    const trimmed = value.trim()
    if (!trimmed) {
      await this.clearApiKey(provider)
      return
    }
    if (!this.#backend || !this.#keychainAvailable) {
      throw new Error(KEYCHAIN_UNAVAILABLE_ERROR)
    }
    this.#backend.setPassword(KEYCHAIN_SERVICE, account, trimmed)
    this.#keys[account] = trimmed
    if (provider === 'openrouter') await this.#deleteLegacyFile()
  }

  async clearApiKey(provider: LlmProviderId = 'openrouter'): Promise<void> {
    const account = llmAccount(provider)
    this.#keys[account] = null
    if (this.#backend && this.#keychainAvailable) {
      this.#backend.deletePassword(KEYCHAIN_SERVICE, account)
    }
    if (provider === 'openrouter') await this.#deleteLegacyFile()
  }

  async setTtsApiKey(provider: TtsSecretProvider, value: string): Promise<void> {
    const account = ttsAccount(provider)
    const trimmed = value.trim()
    if (!trimmed) {
      await this.clearTtsApiKey(provider)
      return
    }
    if (!this.#backend || !this.#keychainAvailable) throw new Error(KEYCHAIN_UNAVAILABLE_ERROR)
    this.#backend.setPassword(KEYCHAIN_SERVICE, account, trimmed)
    this.#keys[account] = trimmed
  }

  async clearTtsApiKey(provider: TtsSecretProvider): Promise<void> {
    const account = ttsAccount(provider)
    this.#keys[account] = null
    if (this.#backend && this.#keychainAvailable) {
      this.#backend.deletePassword(KEYCHAIN_SERVICE, account)
    }
  }

  #readKeychain(account: SecretAccount): string | null {
    if (!this.#backend) return null
    try {
      const value = this.#backend.getPassword(KEYCHAIN_SERVICE, account)
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
    backend.getPassword(KEYCHAIN_SERVICE, 'openrouter')
    return true
  } catch {
    return false
  }
}

function secretAccounts(): SecretAccount[] {
  return ['openrouter', 'custom-llm', 'ollama-llm', 'lmstudio-llm', 'gemini-tts', 'elevenlabs-tts']
}

function llmAccount(provider: LlmProviderId): SecretAccount {
  if (provider === 'openrouter') return 'openrouter'
  return `${provider}-llm`
}

function ttsAccount(provider: TtsSecretProvider): SecretAccount {
  return provider === 'gemini' ? 'gemini-tts' : 'elevenlabs-tts'
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
