import { DEFAULT_ENDPOINT_SETTINGS, type EndpointSettings } from './asr'
import { DEFAULT_LLM_SETTINGS, type LlmSettings } from './llm'

export type AppSettings = {
  activeModelId: string
  wakeWordEnabled: boolean
  endpoint: EndpointSettings
  llm: LlmSettings
  onboardingCompleted: boolean
}

export type AppSettingsPatch = Partial<Omit<AppSettings, 'endpoint' | 'llm'>> & {
  endpoint?: Partial<EndpointSettings>
  llm?: Partial<LlmSettings>
}

export { DEFAULT_ENDPOINT_SETTINGS, DEFAULT_LLM_SETTINGS }
