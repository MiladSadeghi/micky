import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import type { LanguageModel } from 'ai'
import { CURATED_LLM_MODELS, type LlmModelInfo } from '@/lib/llm'
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
        curated: false
      }))
    return [...CURATED_LLM_MODELS, ...extras]
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
