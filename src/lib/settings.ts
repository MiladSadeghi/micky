import { DEFAULT_ENDPOINT_SETTINGS, type EndpointSettings } from './asr'
import { DEFAULT_LLM_SETTINGS, type LlmSettings } from './llm'
import { DEFAULT_TTS_SETTINGS, type TtsSettings } from './tts'
import { DEFAULT_WEB_SEARCH_SETTINGS, type WebSearchSettings } from './web-search'

export const SETTINGS_SNAPSHOT_CHANNEL = 'settings:snapshot'
export const APPEARANCE_SNAPSHOT_CHANNEL = 'appearance:snapshot'

export const DEFAULT_ASSISTANT_SHORTCUT = 'CommandOrControl+Shift+Space'
export const DEFAULT_DICTATION_SHORTCUT = 'CommandOrControl+Shift+D'
export const DEFAULT_WAKE_WORD_SHORTCUT = 'CommandOrControl+Shift+M'
export const DEFAULT_VISION_MODEL_ID = 'google/gemini-2.5-flash'
export const DEFAULT_THEME = 'dark'
export const DEFAULT_FONT_FAMILY = 'Vazirmatn'
export const DEFAULT_AUDIO_DEVICE_ID = 'default'

export type AppTheme = 'light' | 'dark'

export type AppSettings = {
  activeModelId: string
  wakeWordEnabled: boolean
  endpoint: EndpointSettings
  llm: LlmSettings
  tts: TtsSettings
  webSearch: WebSearchSettings
  onboardingCompleted: boolean
  systemToolsEnabled: boolean
  assistantShortcut: string
  dictationShortcut: string
  wakeWordShortcut: string
  dictationAiCleanup: boolean
  dictationAutoPaste: boolean
  launchAtLogin: boolean
  visionModelId: string
  screenDisclosureAccepted: boolean
  chatHistoryEnabled: boolean
  skillsEnabled: boolean
  disabledSkillIds: string[]
  theme: AppTheme
  fontFamily: string
  inputDeviceId: string
  outputDeviceId: string
}

export type SettingsSnapshot = {
  wakeWordEnabled: boolean
  systemToolsEnabled: boolean
  assistantShortcut: string
  dictationShortcut: string
  wakeWordShortcut: string
  dictationAiCleanup: boolean
  dictationAutoPaste: boolean
  launchAtLogin: boolean
  visionModelId: string
  screenDisclosureAccepted: boolean
  chatHistoryEnabled: boolean
  theme: AppTheme
  fontFamily: string
  inputDeviceId: string
  outputDeviceId: string
  shortcutError: string | null
}

export type AppearanceSnapshot = Pick<SettingsSnapshot, 'theme' | 'fontFamily'>

export function toSettingsSnapshot(
  settings: AppSettings,
  shortcutError: string | null = null
): SettingsSnapshot {
  return {
    wakeWordEnabled: settings.wakeWordEnabled !== false,
    systemToolsEnabled: settings.systemToolsEnabled !== false,
    assistantShortcut: settings.assistantShortcut,
    dictationShortcut: settings.dictationShortcut,
    wakeWordShortcut: settings.wakeWordShortcut,
    dictationAiCleanup: settings.dictationAiCleanup,
    dictationAutoPaste: settings.dictationAutoPaste,
    launchAtLogin: settings.launchAtLogin,
    visionModelId: settings.visionModelId,
    screenDisclosureAccepted: settings.screenDisclosureAccepted,
    chatHistoryEnabled: settings.chatHistoryEnabled !== false,
    theme: settings.theme,
    fontFamily: settings.fontFamily,
    inputDeviceId: settings.inputDeviceId,
    outputDeviceId: settings.outputDeviceId,
    shortcutError
  }
}

export function toAppearanceSnapshot(settings: AppSettings): AppearanceSnapshot {
  return { theme: settings.theme, fontFamily: settings.fontFamily }
}

export type AppSettingsPatch = Partial<
  Omit<AppSettings, 'endpoint' | 'llm' | 'tts' | 'webSearch'>
> & {
  endpoint?: Partial<EndpointSettings>
  llm?: Partial<LlmSettings>
  tts?: Partial<TtsSettings>
  webSearch?: Partial<WebSearchSettings>
}

export {
  DEFAULT_ENDPOINT_SETTINGS,
  DEFAULT_LLM_SETTINGS,
  DEFAULT_TTS_SETTINGS,
  DEFAULT_WEB_SEARCH_SETTINGS
}
