import type { AgentDelta, AgentStatus } from '@/lib/agent'
import type { ConversationStatus } from '@/lib/conversation'
import type { ChatDetail, ChatSearchHit, ChatSearchOptions, ChatsSnapshot } from '@/lib/chats'
import type { ModelsSnapshot, SpeechStatus, SpeechTranscript } from '@/lib/asr'
import type { LlmProviderId, LlmSnapshot, OpenAiCompatibleProviderId } from '@/lib/llm'
import type { AppTheme, SettingsSnapshot } from '@/lib/settings'
import type { SoulFileId, SoulSnapshot, UserProfileDraft } from '@/lib/soul'
import type { WakeWordActivation, WakeWordStatus } from '@/lib/wake-word'
import type { TtsPlayback, TtsProviderId, TtsSnapshot, TtsStatus } from '@/lib/tts'
import type { DesktopPlatform } from '@/lib/shortcuts'
import type { SkillsSnapshot } from '@/lib/skills'
import type { EarconKind } from '@/lib/earcon'

export type MickyAPI = {
  wakeWord: {
    getStatus: () => Promise<WakeWordStatus>
    setEnabled: (enabled: boolean) => Promise<WakeWordStatus>
    retry: () => Promise<WakeWordStatus>
    activateManually: () => Promise<WakeWordStatus>
    resume: () => Promise<void>
    processAudio: (buffer: ArrayBuffer) => void
    reportCaptureError: (error: string) => void
    onStatusChange: (listener: (status: WakeWordStatus) => void) => () => void
    onActivation: (listener: (activation: WakeWordActivation) => void) => () => void
  }
  speech: {
    getStatus: () => Promise<SpeechStatus>
    onStatusChange: (listener: (status: SpeechStatus) => void) => () => void
    onTranscript: (listener: (transcript: SpeechTranscript) => void) => () => void
  }
  tts: {
    getStatus: () => Promise<TtsStatus>
    getSnapshot: () => Promise<TtsSnapshot>
    setEnabled: (enabled: boolean) => Promise<TtsSnapshot>
    setProvider: (providerId: TtsProviderId) => Promise<TtsSnapshot>
    setVoice: (providerId: TtsProviderId, voiceId: string) => Promise<TtsSnapshot>
    setApiKey: (providerId: TtsProviderId, apiKey: string) => Promise<TtsSnapshot>
    clearApiKey: (providerId: TtsProviderId) => Promise<TtsSnapshot>
    refreshVoices: () => Promise<TtsSnapshot>
    preview: () => Promise<void>
    openKeys: (providerId: TtsProviderId) => Promise<void>
    playbackFinished: (id: string, error?: string) => void
    onStatusChange: (listener: (status: TtsStatus) => void) => () => void
    onSnapshotChange: (listener: (snapshot: TtsSnapshot) => void) => () => void
    onPlayback: (listener: (playback: TtsPlayback) => void) => () => void
    onStop: (listener: (id: string) => void) => () => void
  }
  conversation: {
    getStatus: () => Promise<ConversationStatus>
    resolveApproval: (approved: boolean) => void
    onStatusChange: (listener: (status: ConversationStatus) => void) => () => void
  }
  chats: {
    getSnapshot: () => Promise<ChatsSnapshot>
    get: (chatId: string) => Promise<ChatDetail | null>
    search: (options: ChatSearchOptions) => Promise<ChatSearchHit[]>
    resume: (chatId: string) => Promise<{ resumed: boolean; snapshot: ChatsSnapshot }>
    delete: (chatId: string) => Promise<{ deleted: boolean; snapshot: ChatsSnapshot }>
    clear: () => Promise<ChatsSnapshot>
    onSnapshotChange: (listener: (snapshot: ChatsSnapshot) => void) => () => void
  }
  models: {
    getStatus: () => Promise<ModelsSnapshot>
    download: (modelId: string) => Promise<ModelsSnapshot>
    cancel: (modelId: string) => Promise<ModelsSnapshot>
    remove: (modelId: string) => Promise<ModelsSnapshot>
    setActive: (modelId: string) => Promise<ModelsSnapshot>
    openCard: (url: string) => Promise<void>
    openFolder: () => Promise<void>
    onStatusChange: (listener: (snapshot: ModelsSnapshot) => void) => () => void
  }
  agent: {
    getStatus: () => Promise<AgentStatus>
    send: (text: string) => Promise<void>
    abort: () => Promise<AgentStatus>
    reset: () => Promise<AgentStatus>
    onStatusChange: (listener: (status: AgentStatus) => void) => () => void
    onDelta: (listener: (delta: AgentDelta) => void) => () => void
  }
  settings: {
    getSnapshot: () => Promise<SettingsSnapshot>
    setSystemToolsEnabled: (enabled: boolean) => Promise<SettingsSnapshot>
    setChatHistoryEnabled: (enabled: boolean) => Promise<SettingsSnapshot>
    setShortcut: (
      kind: 'assistant' | 'dictation' | 'wakeWord',
      accelerator: string
    ) => Promise<SettingsSnapshot>
    setDictationAiCleanup: (enabled: boolean) => Promise<SettingsSnapshot>
    setDictationAutoPaste: (enabled: boolean) => Promise<SettingsSnapshot>
    setLaunchAtLogin: (enabled: boolean) => Promise<SettingsSnapshot>
    setVisionModel: (modelId: string) => Promise<SettingsSnapshot>
    setTheme: (theme: AppTheme) => Promise<SettingsSnapshot>
    setFontFamily: (fontFamily: string) => Promise<SettingsSnapshot>
    onSnapshotChange: (listener: (snapshot: SettingsSnapshot) => void) => () => void
  }
  skills: {
    getSnapshot: () => Promise<SkillsSnapshot>
    refresh: () => Promise<SkillsSnapshot>
    setEnabled: (enabled: boolean) => Promise<SkillsSnapshot>
    setSkillEnabled: (id: string, enabled: boolean) => Promise<SkillsSnapshot>
    openCatalog: () => Promise<void>
    onSnapshotChange: (listener: (snapshot: SkillsSnapshot) => void) => () => void
  }
  app: {
    platform: DesktopPlatform
    isDevelopment: boolean
    setWindowMode: (mode: 'home' | 'settings') => Promise<void>
    onOpenSettings: (listener: () => void) => () => void
    onEarcon: (listener: (kind: EarconKind) => void) => () => void
  }
  llm: {
    getSnapshot: () => Promise<LlmSnapshot>
    setProvider: (providerId: LlmProviderId) => Promise<LlmSnapshot>
    setBaseUrl: (providerId: OpenAiCompatibleProviderId, baseUrl: string) => Promise<LlmSnapshot>
    setModel: (modelId: string) => Promise<LlmSnapshot>
    addCustomModel: (modelId: string) => Promise<LlmSnapshot>
    removeCustomModel: (modelId: string) => Promise<LlmSnapshot>
    setApiKey: (providerId: LlmProviderId, apiKey: string) => Promise<LlmSnapshot>
    clearApiKey: (providerId: LlmProviderId) => Promise<LlmSnapshot>
    refreshModels: () => Promise<LlmSnapshot>
    openKeys: () => Promise<void>
    onSnapshotChange: (listener: (snapshot: LlmSnapshot) => void) => () => void
  }
  soul: {
    getSnapshot: () => Promise<SoulSnapshot>
    readFile: (id: SoulFileId) => Promise<string>
    writeFile: (id: SoulFileId, content: string) => Promise<SoulSnapshot>
    completeOnboarding: (draft: UserProfileDraft) => Promise<SoulSnapshot>
    dismissOnboarding: () => Promise<SoulSnapshot>
    restartOnboarding: () => Promise<SoulSnapshot>
    onSnapshotChange: (listener: (snapshot: SoulSnapshot) => void) => () => void
  }
}
