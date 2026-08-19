export const LLM_SNAPSHOT_CHANNEL = 'llm:snapshot'
export const OPENROUTER_KEYS_URL = 'https://openrouter.ai/keys'
export const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models'

export type LlmProviderId = 'openrouter'

export type LlmSettings = {
  providerId: LlmProviderId
  modelId: string
  customModelIds: string[]
  temperature: number
}

export type LlmModelInfo = {
  id: string
  label: string
  description: string
  curated: boolean
}

export type LlmSnapshot = {
  providerId: LlmProviderId
  modelId: string
  customModelIds: string[]
  catalog: LlmModelInfo[]
  hasApiKey: boolean
  keychainAvailable: boolean
  configured: boolean
  error: string | null
}

export const DEFAULT_LLM_PROVIDER_ID: LlmProviderId = 'openrouter'
export const DEFAULT_LLM_MODEL_ID = 'qwen/qwen3.7-flash'
export const DEFAULT_LLM_TEMPERATURE = 0.7

export const DEFAULT_LLM_SETTINGS: LlmSettings = {
  providerId: DEFAULT_LLM_PROVIDER_ID,
  modelId: DEFAULT_LLM_MODEL_ID,
  customModelIds: [],
  temperature: DEFAULT_LLM_TEMPERATURE
}

export const CURATED_LLM_MODELS: LlmModelInfo[] = [
  {
    id: 'qwen/qwen3.7-flash',
    label: 'Qwen 3.7 Flash',
    description: 'سریع و ارزان، فارسی قوی',
    curated: true
  },
  {
    id: 'qwen/qwen3.6-plus',
    label: 'Qwen 3.6 Plus',
    description: 'دقیق‌تر برای مکالمه و ابزار',
    curated: true
  },
  {
    id: 'google/gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    description: 'سریع و چندزبانه',
    curated: true
  },
  {
    id: 'openai/gpt-5.4-mini',
    label: 'GPT-5.4 Mini',
    description: 'سبک، با پشتیبانی ابزار',
    curated: true
  },
  {
    id: 'openai/gpt-5.4',
    label: 'GPT-5.4',
    description: 'قوی‌تر، هزینه بیشتر',
    curated: true
  },
  {
    id: 'anthropic/claude-sonnet-4.6',
    label: 'Claude Sonnet 4.6',
    description: 'دقیق با حلقه ابزار',
    curated: true
  }
]
