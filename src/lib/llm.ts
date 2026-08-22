export const LLM_SNAPSHOT_CHANNEL = 'llm:snapshot'
export const OPENROUTER_KEYS_URL = 'https://openrouter.ai/keys'
export const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models'

export type LlmProviderId = 'openrouter' | 'custom' | 'ollama' | 'lmstudio'
export type OpenAiCompatibleProviderId = Exclude<LlmProviderId, 'openrouter'>

export type LlmProviderOption = {
  id: LlmProviderId
  label: string
  description: string
  local: boolean
  apiKeyRequired: boolean
}

export type LlmProviderModelIds = Record<LlmProviderId, string>
export type LlmBaseUrls = Record<OpenAiCompatibleProviderId, string>
export type LlmReasoningEffort = 'default' | 'none' | 'low' | 'medium' | 'high'

export type LlmSettings = {
  providerId: LlmProviderId
  modelId: string
  providerModelIds: LlmProviderModelIds
  baseUrls: LlmBaseUrls
  customModelIds: string[]
  temperature: number
  reasoningEffort: LlmReasoningEffort
}

export type LlmModelInfo = {
  id: string
  label: string
  description: string
  curated: boolean
  inputModalities: string[]
  supportsReasoning?: boolean
}

export type LlmSnapshot = {
  providerId: LlmProviderId
  modelId: string
  baseUrl: string | null
  customModelIds: string[]
  catalog: LlmModelInfo[]
  hasApiKey: boolean
  apiKeyRequired: boolean
  local: boolean
  keychainAvailable: boolean
  configured: boolean
  temperature: number
  reasoningEffort: LlmReasoningEffort
  supportsReasoning: boolean
  error: string | null
}

export const DEFAULT_LLM_PROVIDER_ID: LlmProviderId = 'openrouter'
export const DEFAULT_LLM_MODEL_ID = 'qwen/qwen3.7-flash'
export const DEFAULT_LLM_TEMPERATURE = 0.7
export const DEFAULT_LLM_REASONING_EFFORT: LlmReasoningEffort = 'default'
export const DEFAULT_LLM_PROVIDER_MODEL_IDS: LlmProviderModelIds = {
  openrouter: DEFAULT_LLM_MODEL_ID,
  custom: '',
  ollama: '',
  lmstudio: ''
}
export const DEFAULT_LLM_BASE_URLS: LlmBaseUrls = {
  custom: 'http://localhost:8080/v1',
  ollama: 'http://localhost:11434/v1',
  lmstudio: 'http://localhost:1234/v1'
}

export const LLM_PROVIDER_OPTIONS: LlmProviderOption[] = [
  {
    id: 'openrouter',
    label: 'OpenRouter',
    description: 'مدل‌های ابری آماده',
    local: false,
    apiKeyRequired: true
  },
  {
    id: 'custom',
    label: 'سفارشی',
    description: 'API سازگار با OpenAI',
    local: false,
    apiKeyRequired: false
  },
  {
    id: 'ollama',
    label: 'Ollama',
    description: 'مدل‌های محلی Ollama',
    local: true,
    apiKeyRequired: false
  },
  {
    id: 'lmstudio',
    label: 'LM Studio',
    description: 'سرور محلی LM Studio',
    local: true,
    apiKeyRequired: false
  }
]

export const DEFAULT_LLM_SETTINGS: LlmSettings = {
  providerId: DEFAULT_LLM_PROVIDER_ID,
  modelId: DEFAULT_LLM_MODEL_ID,
  providerModelIds: { ...DEFAULT_LLM_PROVIDER_MODEL_IDS },
  baseUrls: { ...DEFAULT_LLM_BASE_URLS },
  customModelIds: [],
  temperature: DEFAULT_LLM_TEMPERATURE,
  reasoningEffort: DEFAULT_LLM_REASONING_EFFORT
}

export function isLlmProviderId(value: unknown): value is LlmProviderId {
  return LLM_PROVIDER_OPTIONS.some((provider) => provider.id === value)
}

export function isOpenAiCompatibleProviderId(
  value: LlmProviderId
): value is OpenAiCompatibleProviderId {
  return value !== 'openrouter'
}

export function isLlmReasoningEffort(value: unknown): value is LlmReasoningEffort {
  return (
    value === 'default' ||
    value === 'none' ||
    value === 'low' ||
    value === 'medium' ||
    value === 'high'
  )
}

export const CURATED_LLM_MODELS: LlmModelInfo[] = [
  {
    id: 'qwen/qwen3.7-flash',
    label: 'Qwen 3.7 Flash',
    description: 'سریع و ارزان، فارسی قوی',
    curated: true,
    inputModalities: ['text']
  },
  {
    id: 'qwen/qwen3.6-plus',
    label: 'Qwen 3.6 Plus',
    description: 'دقیق‌تر برای مکالمه و ابزار',
    curated: true,
    inputModalities: ['text']
  },
  {
    id: 'google/gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    description: 'سریع و چندزبانه',
    curated: true,
    inputModalities: ['text', 'image']
  },
  {
    id: 'openai/gpt-5.4-mini',
    label: 'GPT-5.4 Mini',
    description: 'سبک، با پشتیبانی ابزار',
    curated: true,
    inputModalities: ['text', 'image']
  },
  {
    id: 'openai/gpt-5.4',
    label: 'GPT-5.4',
    description: 'قوی‌تر، هزینه بیشتر',
    curated: true,
    inputModalities: ['text', 'image']
  },
  {
    id: 'anthropic/claude-sonnet-4.6',
    label: 'Claude Sonnet 4.6',
    description: 'دقیق با حلقه ابزار',
    curated: true,
    inputModalities: ['text', 'image']
  }
]
