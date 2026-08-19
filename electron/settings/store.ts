import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { DEFAULT_ENDPOINT_SETTINGS } from '@/lib/asr'
import { DEFAULT_ASR_MODEL_ID, getAsrModel } from '@/lib/asr-models'
import {
  CURATED_LLM_MODELS,
  DEFAULT_LLM_MODEL_ID,
  DEFAULT_LLM_PROVIDER_ID,
  DEFAULT_LLM_SETTINGS,
  DEFAULT_LLM_TEMPERATURE,
  type LlmProviderId,
  type LlmSettings
} from '@/lib/llm'
import type { AppSettings, AppSettingsPatch } from '@/lib/settings'

const SETTINGS_FILE_NAME = 'settings.json'
const CURATED_MODEL_IDS = new Set(CURATED_LLM_MODELS.map((model) => model.id))

export const DEFAULT_APP_SETTINGS: AppSettings = {
  activeModelId: DEFAULT_ASR_MODEL_ID,
  wakeWordEnabled: true,
  endpoint: { ...DEFAULT_ENDPOINT_SETTINGS },
  llm: {
    ...DEFAULT_LLM_SETTINGS,
    customModelIds: []
  },
  onboardingCompleted: false
}

export class SettingsStore {
  #path: string
  #settings: AppSettings = cloneSettings(DEFAULT_APP_SETTINGS)

  constructor(userDataPath: string) {
    this.#path = join(userDataPath, SETTINGS_FILE_NAME)
  }

  async load(): Promise<AppSettings> {
    try {
      const raw = await readFile(this.#path, 'utf8')
      this.#settings = normalizeSettings(JSON.parse(raw) as unknown)
    } catch {
      this.#settings = cloneSettings(DEFAULT_APP_SETTINGS)
    }
    return this.get()
  }

  get(): AppSettings {
    return cloneSettings(this.#settings)
  }

  async update(patch: AppSettingsPatch): Promise<AppSettings> {
    this.#settings = normalizeSettings({
      ...this.#settings,
      ...patch,
      endpoint: { ...this.#settings.endpoint, ...patch.endpoint },
      llm: { ...this.#settings.llm, ...patch.llm }
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

function cloneSettings(settings: AppSettings): AppSettings {
  return {
    ...settings,
    endpoint: { ...settings.endpoint },
    llm: {
      ...settings.llm,
      customModelIds: [...settings.llm.customModelIds]
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeLlmSettings(value: unknown): LlmSettings {
  const record = isRecord(value) ? value : {}
  const providerId: LlmProviderId =
    record.providerId === 'openrouter' ? 'openrouter' : DEFAULT_LLM_PROVIDER_ID
  const modelId =
    typeof record.modelId === 'string' && record.modelId.trim()
      ? record.modelId.trim()
      : DEFAULT_LLM_MODEL_ID
  const customModelIds = Array.isArray(record.customModelIds)
    ? [
        ...new Set(
          record.customModelIds.filter(
            (id): id is string =>
              typeof id === 'string' && id.trim().length > 0 && !CURATED_MODEL_IDS.has(id.trim())
          )
        )
      ]
    : []
  const temperature = Math.min(
    2,
    Math.max(0, readNumber(record.temperature, DEFAULT_LLM_TEMPERATURE))
  )

  return { providerId, modelId, customModelIds, temperature }
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
    onboardingCompleted: record.onboardingCompleted === true,
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
    },
    llm: normalizeLlmSettings(record.llm)
  }
}
