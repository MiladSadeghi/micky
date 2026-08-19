import type { AgentDelta, AgentStatus } from '@/lib/agent'
import type { ConversationStatus } from '@/lib/conversation'
import type { ModelsSnapshot, SpeechStatus, SpeechTranscript } from '@/lib/asr'
import type { LlmSnapshot } from '@/lib/llm'
import type { SoulFileId, SoulSnapshot, UserProfileDraft } from '@/lib/soul'
import type { WakeWordActivation, WakeWordStatus } from '@/lib/wake-word'

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
  conversation: {
    getStatus: () => Promise<ConversationStatus>
    onStatusChange: (listener: (status: ConversationStatus) => void) => () => void
  }
  models: {
    getStatus: () => Promise<ModelsSnapshot>
    download: (modelId: string) => Promise<ModelsSnapshot>
    cancel: (modelId: string) => Promise<ModelsSnapshot>
    remove: (modelId: string) => Promise<ModelsSnapshot>
    setActive: (modelId: string) => Promise<ModelsSnapshot>
    openCard: (url: string) => Promise<void>
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
  llm: {
    getSnapshot: () => Promise<LlmSnapshot>
    setModel: (modelId: string) => Promise<LlmSnapshot>
    addCustomModel: (modelId: string) => Promise<LlmSnapshot>
    removeCustomModel: (modelId: string) => Promise<LlmSnapshot>
    setApiKey: (apiKey: string) => Promise<LlmSnapshot>
    clearApiKey: () => Promise<LlmSnapshot>
    refreshModels: () => Promise<LlmSnapshot>
    openKeys: () => Promise<void>
    onSnapshotChange: (listener: (snapshot: LlmSnapshot) => void) => () => void
  }
  soul: {
    getSnapshot: () => Promise<SoulSnapshot>
    readFile: (id: SoulFileId) => Promise<string>
    writeFile: (id: SoulFileId, content: string) => Promise<SoulSnapshot>
    completeOnboarding: (draft: UserProfileDraft) => Promise<SoulSnapshot>
    onSnapshotChange: (listener: (snapshot: SoulSnapshot) => void) => () => void
  }
}
