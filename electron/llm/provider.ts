import type { LanguageModel } from 'ai'
import type { LlmModelInfo, LlmProviderId } from '@/lib/llm'

export type LlmProviderCapabilities = {
  streaming: boolean
  tools: boolean
}

export interface LlmProvider {
  readonly id: LlmProviderId
  readonly capabilities: LlmProviderCapabilities
  getModel(modelId: string): LanguageModel
  listModels(customModelIds: string[]): Promise<LlmModelInfo[]>
  isConfigured(): boolean
}
