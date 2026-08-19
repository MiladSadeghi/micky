import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  DEFAULT_ENDPOINT_SETTINGS,
  type AppSettings,
  type EndpointSettings
} from '../../shared/asr'
import { DEFAULT_ASR_MODEL_ID, getAsrModel } from '../../shared/asr-models'

const SETTINGS_FILE_NAME = 'settings.json'

export const DEFAULT_APP_SETTINGS: AppSettings = {
  activeModelId: DEFAULT_ASR_MODEL_ID,
  wakeWordEnabled: true,
  endpoint: { ...DEFAULT_ENDPOINT_SETTINGS }
}

export class SettingsStore {
  #path: string
  #settings: AppSettings = { ...DEFAULT_APP_SETTINGS, endpoint: { ...DEFAULT_ENDPOINT_SETTINGS } }

  constructor(userDataPath: string) {
    this.#path = join(userDataPath, SETTINGS_FILE_NAME)
  }

  async load(): Promise<AppSettings> {
    try {
      const raw = await readFile(this.#path, 'utf8')
      this.#settings = normalizeSettings(JSON.parse(raw) as unknown)
    } catch {
      this.#settings = {
        ...DEFAULT_APP_SETTINGS,
        endpoint: { ...DEFAULT_ENDPOINT_SETTINGS }
      }
    }
    return this.get()
  }

  get(): AppSettings {
    return {
      ...this.#settings,
      endpoint: { ...this.#settings.endpoint }
    }
  }

  async update(
    patch: Partial<Omit<AppSettings, 'endpoint'>> & { endpoint?: Partial<EndpointSettings> }
  ): Promise<AppSettings> {
    this.#settings = normalizeSettings({
      ...this.#settings,
      ...patch,
      endpoint: { ...this.#settings.endpoint, ...patch.endpoint }
    })
    await this.#persist()
    return this.get()
  }

  async #persist(): Promise<void> {
    await mkdir(dirname(this.#path), { recursive: true })
    const tempPath = `${this.#path}.tmp`
    await writeFile(tempPath, `${JSON.stringify(this.#settings, null, 2)}\n`, 'utf8')
    await rename(tempPath, this.#path)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeSettings(value: unknown): AppSettings {
  const record = isRecord(value) ? value : {}
  const endpointRecord = isRecord(record.endpoint) ? record.endpoint : {}
  const activeModelId =
    typeof record.activeModelId === 'string' && getAsrModel(record.activeModelId)
      ? record.activeModelId
      : DEFAULT_ASR_MODEL_ID

  return {
    activeModelId,
    wakeWordEnabled: record.wakeWordEnabled !== false,
    endpoint: {
      rule1MinTrailingSilence: readNumber(
        endpointRecord.rule1MinTrailingSilence,
        DEFAULT_ENDPOINT_SETTINGS.rule1MinTrailingSilence
      ),
      rule2MinTrailingSilence: readNumber(
        endpointRecord.rule2MinTrailingSilence,
        DEFAULT_ENDPOINT_SETTINGS.rule2MinTrailingSilence
      ),
      rule3MinUtteranceLength: readNumber(
        endpointRecord.rule3MinUtteranceLength,
        DEFAULT_ENDPOINT_SETTINGS.rule3MinUtteranceLength
      )
    }
  }
}
