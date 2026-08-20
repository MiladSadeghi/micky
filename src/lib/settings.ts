import { DEFAULT_ENDPOINT_SETTINGS, type EndpointSettings } from './asr'
import { DEFAULT_LLM_SETTINGS, type LlmSettings } from './llm'
import { DEFAULT_TTS_SETTINGS, type TtsSettings } from './tts'

export const SETTINGS_SNAPSHOT_CHANNEL = 'settings:snapshot'

export const DEFAULT_ASSISTANT_SHORTCUT = 'CommandOrControl+Shift+Space'
export const DEFAULT_DICTATION_SHORTCUT = 'CommandOrControl+Shift+D'
export const DEFAULT_VISION_MODEL_ID = 'google/gemini-2.5-flash'

export type AppSettings = {
  activeModelId: string
  wakeWordEnabled: boolean
  endpoint: EndpointSettings
  llm: LlmSettings
  tts: TtsSettings
  onboardingCompleted: boolean
  systemToolsEnabled: boolean
  assistantShortcut: string
  dictationShortcut: string
  dictationAiCleanup: boolean
  dictationAutoPaste: boolean
  launchAtLogin: boolean
  visionModelId: string
  screenDisclosureAccepted: boolean
  chatHistoryEnabled: boolean
}

export type SettingsSnapshot = {
  systemToolsEnabled: boolean
  assistantShortcut: string
  dictationShortcut: string
  dictationAiCleanup: boolean
  dictationAutoPaste: boolean
  launchAtLogin: boolean
  visionModelId: string
  screenDisclosureAccepted: boolean
  chatHistoryEnabled: boolean
  shortcutError: string | null
}

export function toSettingsSnapshot(
  settings: AppSettings,
  shortcutError: string | null = null
): SettingsSnapshot {
  return {
    systemToolsEnabled: settings.systemToolsEnabled !== false,
    assistantShortcut: settings.assistantShortcut,
    dictationShortcut: settings.dictationShortcut,
    dictationAiCleanup: settings.dictationAiCleanup,
    dictationAutoPaste: settings.dictationAutoPaste,
    launchAtLogin: settings.launchAtLogin,
    visionModelId: settings.visionModelId,
    screenDisclosureAccepted: settings.screenDisclosureAccepted,
    chatHistoryEnabled: settings.chatHistoryEnabled !== false,
    shortcutError
  }
}

export type AppSettingsPatch = Partial<Omit<AppSettings, 'endpoint' | 'llm' | 'tts'>> & {
  endpoint?: Partial<EndpointSettings>
  llm?: Partial<LlmSettings>
  tts?: Partial<TtsSettings>
}

export { DEFAULT_ENDPOINT_SETTINGS, DEFAULT_LLM_SETTINGS, DEFAULT_TTS_SETTINGS }
