import type { BrowserWindow } from 'electron'
import { CURATED_LLM_MODELS, LLM_SNAPSHOT_CHANNEL, type LlmSnapshot } from '@/lib/llm'
import type { SettingsStore } from '../settings/store'
import { OpenRouterProvider } from './openrouter'
import type { LlmProvider } from './provider'
import { SecretStore } from './secrets'

const MODEL_SLUG_PATTERN = /^[a-z0-9._-]+\/[a-z0-9._:+-]+$/i

type LlmServiceOptions = {
  settings: SettingsStore
  secrets: SecretStore
  getWindow: () => BrowserWindow | null
}

export class LlmService {
  #provider: LlmProvider
  #snapshot: LlmSnapshot

  constructor(private readonly options: LlmServiceOptions) {
    this.#provider = new OpenRouterProvider({
      getApiKey: () => options.secrets.getApiKey()
    })
    this.#snapshot = this.#buildSnapshot()
  }

  getProvider(): LlmProvider {
    return this.#provider
  }

  getSnapshot(): LlmSnapshot {
    return this.#snapshot
  }

  isConfigured(): boolean {
    return this.#provider.isConfigured() && Boolean(this.options.settings.get().llm.modelId)
  }

  async refresh(): Promise<LlmSnapshot> {
    const catalog = await this.#provider.listModels(this.options.settings.get().llm.customModelIds)
    this.#snapshot = this.#buildSnapshot(catalog)
    this.#emit()
    return this.#snapshot
  }

  async setModel(modelId: string): Promise<LlmSnapshot> {
    const trimmed = modelId.trim()
    if (!trimmed) throw new Error('شناسه مدل خالی است.')
    await this.options.settings.update({ llm: { modelId: trimmed } })
    return this.refresh()
  }

  async addCustomModel(modelId: string): Promise<LlmSnapshot> {
    const trimmed = modelId.trim()
    if (!MODEL_SLUG_PATTERN.test(trimmed)) {
      throw new Error('شناسه مدل باید شبیه openai/gpt-4o باشد.')
    }
    const settings = this.options.settings.get()
    const customModelIds = unique([...settings.llm.customModelIds, trimmed]).filter(
      (id) => !CURATED_LLM_MODELS.some((model) => model.id === id)
    )
    await this.options.settings.update({
      llm: { customModelIds, modelId: trimmed }
    })
    return this.refresh()
  }

  async removeCustomModel(modelId: string): Promise<LlmSnapshot> {
    const settings = this.options.settings.get()
    const customModelIds = settings.llm.customModelIds.filter((id) => id !== modelId)
    const modelStillKnown =
      CURATED_LLM_MODELS.some((model) => model.id === settings.llm.modelId) ||
      customModelIds.includes(settings.llm.modelId)
    await this.options.settings.update({
      llm: {
        customModelIds,
        modelId: modelStillKnown ? settings.llm.modelId : CURATED_LLM_MODELS[0]?.id
      }
    })
    return this.refresh()
  }

  async setApiKey(value: string): Promise<LlmSnapshot> {
    await this.options.secrets.setApiKey(value)
    return this.refresh()
  }

  async clearApiKey(): Promise<LlmSnapshot> {
    await this.options.secrets.clearApiKey()
    return this.refresh()
  }

  #buildSnapshot(catalog?: LlmSnapshot['catalog']): LlmSnapshot {
    const settings = this.options.settings.get()
    const known = catalog ?? [
      ...CURATED_LLM_MODELS,
      ...settings.llm.customModelIds
        .filter((id) => !CURATED_LLM_MODELS.some((model) => model.id === id))
        .map((id) => ({
          id,
          label: id,
          description: 'مدل سفارشی OpenRouter',
          curated: false
        }))
    ]
    return {
      providerId: settings.llm.providerId,
      modelId: settings.llm.modelId,
      customModelIds: settings.llm.customModelIds,
      catalog: known,
      hasApiKey: this.options.secrets.hasApiKey(),
      keychainAvailable: this.options.secrets.keychainAvailable,
      configured: this.isConfigured(),
      error: this.options.secrets.hasApiKey()
        ? null
        : 'برای حرف‌زدن با میکی، کلید OpenRouter را بگذار.'
    }
  }

  #emit(): void {
    const window = this.options.getWindow()
    if (window && !window.isDestroyed()) {
      window.webContents.send(LLM_SNAPSHOT_CHANNEL, this.#snapshot)
    }
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}
