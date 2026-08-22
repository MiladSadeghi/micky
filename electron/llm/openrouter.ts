import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import type { LanguageModel } from 'ai'
import { CURATED_LLM_MODELS, OPENROUTER_MODELS_URL, type LlmModelInfo } from '@/lib/llm'
import type { LlmProvider, LlmProviderCapabilities } from './provider'

type OpenRouterProviderOptions = {
  getApiKey: () => string | null
  fetch?: typeof globalThis.fetch
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
      const response = await (this.options.fetch ?? globalThis.fetch)(OPENROUTER_MODELS_URL, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8_000)
      })
      if (!response.ok) return catalog
      const payload = (await response.json()) as unknown
      const records = readModelRecords(payload)
      return catalog.map((model) => {
        const record = records.get(model.id)
        return {
          ...model,
          inputModalities: record?.inputModalities ?? model.inputModalities,
          supportsReasoning:
            record?.supportedParameters != null
              ? record.supportedParameters.includes('reasoning')
              : model.supportsReasoning
        }
      })
    } catch {
      return catalog
    }
  }
}

type OpenRouterModelRecord = {
  inputModalities: string[] | null
  supportedParameters: string[] | null
}

function readModelRecords(payload: unknown): Map<string, OpenRouterModelRecord> {
  const output = new Map<string, OpenRouterModelRecord>()
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
    const supportedParameters =
      'supported_parameters' in item && Array.isArray(item.supported_parameters)
        ? item.supported_parameters.filter(
            (value: unknown): value is string => typeof value === 'string'
          )
        : null
    if (id) {
      output.set(id, {
        inputModalities: modalities.length > 0 ? modalities : null,
        supportedParameters
      })
    }
  }
  return output
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
