import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'
import type { LlmModelInfo, LlmProviderId, OpenAiCompatibleProviderId } from '@/lib/llm'
import type { LlmProvider, LlmProviderCapabilities } from './provider'

type OpenAiCompatibleLlmProviderOptions = {
  id: OpenAiCompatibleProviderId
  label: string
  getApiKey: () => string | null
  getBaseUrl: () => string
  fetch?: typeof globalThis.fetch
}

export class OpenAiCompatibleLlmProvider implements LlmProvider {
  readonly id: LlmProviderId
  readonly capabilities: LlmProviderCapabilities = { streaming: true, tools: true }

  constructor(private readonly options: OpenAiCompatibleLlmProviderOptions) {
    this.id = options.id
  }

  isConfigured(): boolean {
    try {
      normalizeLlmBaseUrl(this.options.getBaseUrl())
      return true
    } catch {
      return false
    }
  }

  getModel(modelId: string): LanguageModel {
    const baseURL = normalizeLlmBaseUrl(this.options.getBaseUrl())
    const apiKey = this.options.getApiKey()
    const provider = createOpenAICompatible({
      name: this.id,
      baseURL,
      ...(this.options.fetch ? { fetch: this.options.fetch } : {}),
      ...(apiKey ? { apiKey } : {})
    })
    return provider.chatModel(modelId)
  }

  async listModels(): Promise<LlmModelInfo[]> {
    const baseUrl = normalizeLlmBaseUrl(this.options.getBaseUrl())
    const apiKey = this.options.getApiKey()
    const response = await (this.options.fetch ?? globalThis.fetch)(`${baseUrl}/models`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      signal: AbortSignal.timeout(5_000)
    })
    if (!response.ok) {
      throw new Error(`پاسخ ${this.options.label}: ${response.status}`)
    }
    const payload = (await response.json()) as unknown
    return readCompatibleModels(payload, this.options.label)
  }
}

export function normalizeLlmBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error('آدرس سرور معتبر نیست.')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('آدرس سرور باید با http یا https شروع شود.')
  }
  return trimmed
}

function readCompatibleModels(payload: unknown, providerLabel: string): LlmModelInfo[] {
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('data' in payload) ||
    !Array.isArray(payload.data)
  ) {
    throw new Error(`فهرست مدل‌های ${providerLabel} معتبر نیست.`)
  }
  const seen = new Set<string>()
  const models: LlmModelInfo[] = []
  for (const item of payload.data) {
    if (!item || typeof item !== 'object' || !('id' in item) || typeof item.id !== 'string') {
      continue
    }
    const id = item.id.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    models.push({
      id,
      label: id,
      description: `مدل ${providerLabel}`,
      curated: true,
      inputModalities: ['text'],
      supportsReasoning:
        'supported_parameters' in item && Array.isArray(item.supported_parameters)
          ? item.supported_parameters.includes('reasoning')
          : undefined
    })
  }
  return models
}
