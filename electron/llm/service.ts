import type { BrowserWindow } from 'electron'
import type { LanguageModel } from 'ai'
import {
  CURATED_LLM_MODELS,
  LLM_PROVIDER_OPTIONS,
  LLM_SNAPSHOT_CHANNEL,
  isLlmProviderId,
  isLlmReasoningEffort,
  isOpenAiCompatibleProviderId,
  type LlmModelInfo,
  type LlmProviderId,
  type LlmReasoningEffort,
  type LlmSnapshot,
  type OpenAiCompatibleProviderId
} from '@/lib/llm'
import type { SettingsStore } from '../settings/store'
import { OpenAiCompatibleLlmProvider, normalizeLlmBaseUrl } from './openai-compatible'
import { OpenRouterProvider } from './openrouter'
import type { LlmProvider } from './provider'
import { SecretStore } from './secrets'

const OPENROUTER_MODEL_SLUG_PATTERN = /^[a-z0-9._-]+\/[a-z0-9._:+-]+$/i

type LlmServiceOptions = {
  settings: SettingsStore
  secrets: SecretStore
  getWindow: () => BrowserWindow | null
}

export class LlmService {
  #providers: Record<LlmProviderId, LlmProvider>
  #snapshot: LlmSnapshot

  constructor(private readonly options: LlmServiceOptions) {
    this.#providers = {
      openrouter: new OpenRouterProvider({
        getApiKey: () => options.secrets.getApiKey('openrouter')
      }),
      custom: this.#createCompatibleProvider('custom'),
      ollama: this.#createCompatibleProvider('ollama'),
      lmstudio: this.#createCompatibleProvider('lmstudio')
    }
    this.#snapshot = this.#buildSnapshot()
  }

  getProvider(): LlmProvider {
    return this.#providers[this.options.settings.get().llm.providerId]
  }

  getModel(): LanguageModel {
    const settings = this.options.settings.get().llm
    if (!settings.modelId) throw new Error('مدل زبانی انتخاب نشده.')
    return this.#providers[settings.providerId].getModel(settings.modelId)
  }

  getSnapshot(): LlmSnapshot {
    return this.#snapshot
  }

  getReasoningEffort(): Exclude<LlmReasoningEffort, 'default'> | null {
    const settings = this.options.settings.get().llm
    if (settings.reasoningEffort === 'default' || !this.#activeModelSupportsReasoning()) return null
    return settings.reasoningEffort
  }

  isConfigured(): boolean {
    const settings = this.options.settings.get().llm
    return this.#providers[settings.providerId].isConfigured() && Boolean(settings.modelId)
  }

  getVisionModelId(): string | null {
    const settings = this.options.settings.get()
    const active = this.#snapshot.catalog.find((model) => model.id === settings.llm.modelId)
    if (active?.inputModalities.includes('image')) return active.id
    const fallback = this.#snapshot.catalog.find((model) => model.id === settings.visionModelId)
    return fallback?.inputModalities.includes('image') ? fallback.id : null
  }

  async refresh(): Promise<LlmSnapshot> {
    let settings = this.options.settings.get()
    const provider = this.#providers[settings.llm.providerId]
    let catalog: LlmModelInfo[]
    let connectionError: string | null = null

    try {
      catalog = await provider.listModels(settings.llm.customModelIds)
    } catch {
      catalog = []
      const option = providerOption(settings.llm.providerId)
      connectionError = option.local
        ? `به ${option.label} وصل نشدم. سرور را روشن کن یا آدرس را بررسی کن.`
        : `به ${option.label} وصل نشدم. آدرس و کلید را بررسی کن.`
    }

    if (settings.llm.modelId && !catalog.some((model) => model.id === settings.llm.modelId)) {
      catalog = [...catalog, manualModel(settings.llm.modelId, settings.llm.providerId)]
    }

    if (!settings.llm.modelId && catalog[0]) {
      const modelId = catalog[0].id
      settings = await this.options.settings.update({
        llm: {
          modelId,
          providerModelIds: {
            ...settings.llm.providerModelIds,
            [settings.llm.providerId]: modelId
          }
        }
      })
    }

    this.#snapshot = this.#buildSnapshot(catalog, connectionError)
    this.#emit()
    return this.#snapshot
  }

  async setProvider(providerId: LlmProviderId): Promise<LlmSnapshot> {
    if (!isLlmProviderId(providerId)) throw new Error('سرویس مدل زبانی ناشناخته است.')
    const settings = this.options.settings.get()
    await this.options.settings.update({
      llm: {
        providerId,
        modelId: settings.llm.providerModelIds[providerId]
      }
    })
    return this.refresh()
  }

  async setBaseUrl(providerId: OpenAiCompatibleProviderId, baseUrl: string): Promise<LlmSnapshot> {
    if (!isLlmProviderId(providerId) || !isOpenAiCompatibleProviderId(providerId)) {
      throw new Error('این سرویس آدرس سفارشی ندارد.')
    }
    const normalized = normalizeLlmBaseUrl(baseUrl)
    const settings = this.options.settings.get()
    await this.options.settings.update({
      llm: {
        baseUrls: { ...settings.llm.baseUrls, [providerId]: normalized }
      }
    })
    return settings.llm.providerId === providerId ? this.refresh() : this.#rebuildAndEmit()
  }

  async setModel(modelId: string): Promise<LlmSnapshot> {
    const trimmed = modelId.trim().slice(0, 160)
    if (!trimmed) throw new Error('شناسه مدل خالی است.')
    const settings = this.options.settings.get()
    await this.options.settings.update({
      llm: {
        modelId: trimmed,
        providerModelIds: {
          ...settings.llm.providerModelIds,
          [settings.llm.providerId]: trimmed
        }
      }
    })
    return this.refresh()
  }

  async setTemperature(temperature: number): Promise<LlmSnapshot> {
    if (!Number.isFinite(temperature)) throw new Error('دمای مدل معتبر نیست.')
    await this.options.settings.update({
      llm: { temperature: Math.min(2, Math.max(0, temperature)) }
    })
    return this.#rebuildAndEmit()
  }

  async setReasoningEffort(reasoningEffort: LlmReasoningEffort): Promise<LlmSnapshot> {
    if (!isLlmReasoningEffort(reasoningEffort)) throw new Error('میزان استدلال معتبر نیست.')
    await this.options.settings.update({ llm: { reasoningEffort } })
    return this.#rebuildAndEmit()
  }

  async setVisionModel(modelId: string): Promise<LlmSnapshot> {
    const model = this.#snapshot.catalog.find((candidate) => candidate.id === modelId)
    if (!model?.inputModalities.includes('image')) {
      throw new Error('این مدل ورودی تصویر را پشتیبانی نمی‌کند.')
    }
    await this.options.settings.update({ visionModelId: model.id })
    this.#snapshot = this.#buildSnapshot(this.#snapshot.catalog)
    this.#emit()
    return this.#snapshot
  }

  async addCustomModel(modelId: string): Promise<LlmSnapshot> {
    const trimmed = modelId.trim()
    if (!OPENROUTER_MODEL_SLUG_PATTERN.test(trimmed)) {
      throw new Error('شناسه مدل باید شبیه openai/gpt-4o باشد.')
    }
    const settings = this.options.settings.get()
    const customModelIds = unique([...settings.llm.customModelIds, trimmed]).filter(
      (id) => !CURATED_LLM_MODELS.some((model) => model.id === id)
    )
    await this.options.settings.update({
      llm: {
        providerId: 'openrouter',
        customModelIds,
        modelId: trimmed,
        providerModelIds: { ...settings.llm.providerModelIds, openrouter: trimmed }
      }
    })
    return this.refresh()
  }

  async removeCustomModel(modelId: string): Promise<LlmSnapshot> {
    const settings = this.options.settings.get()
    const customModelIds = settings.llm.customModelIds.filter((id) => id !== modelId)
    const openRouterModelId =
      CURATED_LLM_MODELS.some((model) => model.id === settings.llm.providerModelIds.openrouter) ||
      customModelIds.includes(settings.llm.providerModelIds.openrouter)
        ? settings.llm.providerModelIds.openrouter
        : (CURATED_LLM_MODELS[0]?.id ?? '')
    await this.options.settings.update({
      llm: {
        customModelIds,
        providerModelIds: {
          ...settings.llm.providerModelIds,
          openrouter: openRouterModelId
        },
        ...(settings.llm.providerId === 'openrouter' ? { modelId: openRouterModelId } : {})
      }
    })
    return this.refresh()
  }

  async setApiKey(providerId: LlmProviderId, value: string): Promise<LlmSnapshot> {
    if (!isLlmProviderId(providerId)) throw new Error('سرویس مدل زبانی ناشناخته است.')
    await this.options.secrets.setApiKey(providerId, value)
    return this.options.settings.get().llm.providerId === providerId
      ? this.refresh()
      : this.#rebuildAndEmit()
  }

  async clearApiKey(providerId: LlmProviderId): Promise<LlmSnapshot> {
    if (!isLlmProviderId(providerId)) throw new Error('سرویس مدل زبانی ناشناخته است.')
    await this.options.secrets.clearApiKey(providerId)
    return this.options.settings.get().llm.providerId === providerId
      ? this.refresh()
      : this.#rebuildAndEmit()
  }

  #createCompatibleProvider(providerId: OpenAiCompatibleProviderId): LlmProvider {
    const option = providerOption(providerId)
    return new OpenAiCompatibleLlmProvider({
      id: providerId,
      label: option.label,
      getApiKey: () => this.options.secrets.getApiKey(providerId),
      getBaseUrl: () => this.options.settings.get().llm.baseUrls[providerId]
    })
  }

  #buildSnapshot(
    catalog?: LlmSnapshot['catalog'],
    connectionError: string | null = null
  ): LlmSnapshot {
    const settings = this.options.settings.get()
    const option = providerOption(settings.llm.providerId)
    const known = catalog ?? initialCatalog(settings.llm.providerId, settings.llm.customModelIds)
    const hasApiKey = this.options.secrets.hasApiKey(settings.llm.providerId)
    const configurationError =
      option.apiKeyRequired && !hasApiKey
        ? `برای ${option.label} کلید API را بگذار.`
        : connectionError
          ? connectionError
          : !settings.llm.modelId
            ? 'یک مدل زبانی انتخاب یا وارد کن.'
            : null
    return {
      providerId: settings.llm.providerId,
      modelId: settings.llm.modelId,
      baseUrl: isOpenAiCompatibleProviderId(settings.llm.providerId)
        ? settings.llm.baseUrls[settings.llm.providerId]
        : null,
      customModelIds: settings.llm.customModelIds,
      catalog: known,
      hasApiKey,
      apiKeyRequired: option.apiKeyRequired,
      local: option.local,
      keychainAvailable: this.options.secrets.keychainAvailable,
      configured: this.isConfigured(),
      temperature: settings.llm.temperature,
      reasoningEffort: settings.llm.reasoningEffort,
      supportsReasoning: this.#activeModelSupportsReasoning(known),
      error: configurationError
    }
  }

  #activeModelSupportsReasoning(catalog = this.#snapshot.catalog): boolean {
    const modelId = this.options.settings.get().llm.modelId
    return catalog.some((model) => model.id === modelId && model.supportsReasoning === true)
  }

  #rebuildAndEmit(): LlmSnapshot {
    this.#snapshot = this.#buildSnapshot(this.#snapshot.catalog)
    this.#emit()
    return this.#snapshot
  }

  #emit(): void {
    const window = this.options.getWindow()
    if (window && !window.isDestroyed()) {
      window.webContents.send(LLM_SNAPSHOT_CHANNEL, this.#snapshot)
    }
  }
}

function providerOption(providerId: LlmProviderId) {
  const option = LLM_PROVIDER_OPTIONS.find((candidate) => candidate.id === providerId)
  if (!option) throw new Error('سرویس مدل زبانی ناشناخته است.')
  return option
}

function initialCatalog(providerId: LlmProviderId, customModelIds: string[]): LlmModelInfo[] {
  if (providerId !== 'openrouter') return []
  return [
    ...CURATED_LLM_MODELS,
    ...customModelIds
      .filter((id) => !CURATED_LLM_MODELS.some((model) => model.id === id))
      .map((id) => manualModel(id, providerId))
  ]
}

function manualModel(modelId: string, providerId: LlmProviderId): LlmModelInfo {
  const option = providerOption(providerId)
  return {
    id: modelId,
    label: modelId,
    description: providerId === 'openrouter' ? 'مدل سفارشی OpenRouter' : `مدل دستی ${option.label}`,
    curated: false,
    inputModalities: ['text']
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}
