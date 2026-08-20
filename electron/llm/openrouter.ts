import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import type { LanguageModel } from 'ai'
import { CURATED_LLM_MODELS, OPENROUTER_MODELS_URL, type LlmModelInfo } from '@/lib/llm'
import type { LlmProvider, LlmProviderCapabilities } from './provider'

type OpenRouterProviderOptions = {
  getApiKey: () => string | null
}

export class OpenRouterProvider implements LlmProvider {
  readonly id = 'openrouter'
  readonly capabilities: LlmProviderCapabilities = { streaming: true, tools: true }

  constructor(private readonly options: OpenRouterProviderOptions) {}

  isConfigured(): boolean {
    return Boolean(this.options.getApiKey())
  }

  getModel(modelId: string): LanguageModel {
    const apiKey = this.options.getApiKey()
    if (!apiKey) throw new Error('کلید OpenRouter تنظیم نشده.')
    const openrouter = createOpenRouter({
      apiKey,
      compatibility: 'strict',
      appName: 'Micky',
      appUrl: 'https://micky.app'
    })
    return openrouter(modelId)
  }

  async listModels(customModelIds: string[]): Promise<LlmModelInfo[]> {
    const curatedIds = new Set(CURATED_LLM_MODELS.map((model) => model.id))
    const extras = unique(customModelIds)
      .filter((id) => !curatedIds.has(id))
      .map((id): LlmModelInfo => ({
        id,
        label: id,
        description: 'مدل سفارشی OpenRouter',
        curated: false,
        inputModalities: ['text']
      }))
    const catalog = [...CURATED_LLM_MODELS, ...extras]
    const apiKey = this.options.getApiKey()
    if (!apiKey) return catalog
    try {
      const response = await fetch(OPENROUTER_MODELS_URL, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8_000)
      })
      if (!response.ok) return catalog
      const payload = (await response.json()) as unknown
      const records = readModelRecords(payload)
      return catalog.map((model) => ({
        ...model,
        inputModalities: records.get(model.id) ?? model.inputModalities
      }))
    } catch {
      return catalog
    }
  }
}

function readModelRecords(payload: unknown): Map<string, string[]> {
  const output = new Map<string, string[]>()
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('data' in payload) ||
    !Array.isArray(payload.data)
  ) {
    return output
  }
  for (const item of payload.data) {
    if (!item || typeof item !== 'object') continue
    const id = 'id' in item && typeof item.id === 'string' ? item.id : ''
    const architecture =
      'architecture' in item && item.architecture && typeof item.architecture === 'object'
        ? item.architecture
        : null
    const modalities =
      architecture &&
      'input_modalities' in architecture &&
      Array.isArray(architecture.input_modalities)
        ? architecture.input_modalities.filter(
            (value: unknown): value is string => typeof value === 'string'
          )
        : []
    if (id && modalities.length > 0) output.set(id, modalities)
  }
  return output
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
