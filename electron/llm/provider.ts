import type { LanguageModel } from 'ai'
import type { LlmModelInfo } from '@/lib/llm'

export type LlmProviderCapabilities = {
  streaming: boolean
  tools: boolean
}

export interface LlmProvider {
  readonly id: string
  readonly capabilities: LlmProviderCapabilities
  getModel(modelId: string): LanguageModel
  listModels(customModelIds: string[]): Promise<LlmModelInfo[]>
  isConfigured(): boolean
}
