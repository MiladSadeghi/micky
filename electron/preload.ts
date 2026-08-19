import { contextBridge, ipcRenderer } from 'electron'
import {
  AGENT_DELTA_CHANNEL,
  AGENT_STATUS_CHANNEL,
  type AgentDelta,
  type AgentStatus
} from '@/lib/agent'
import {
  AUDIO_CHUNK_CHANNEL,
  MODELS_STATUS_CHANNEL,
  SPEECH_STATUS_CHANNEL,
  SPEECH_TRANSCRIPT_CHANNEL,
  type ModelsSnapshot,
  type SpeechStatus,
  type SpeechTranscript
} from '@/lib/asr'
import type { MickyAPI } from '@/lib/desktop-api'
import { LLM_SNAPSHOT_CHANNEL, type LlmSnapshot } from '@/lib/llm'
import {
  SOUL_SNAPSHOT_CHANNEL,
  type SoulFileId,
  type SoulSnapshot,
  type UserProfileDraft
} from '@/lib/soul'
import type { WakeWordActivation, WakeWordStatus } from '@/lib/wake-word'

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, payload: T): void => listener(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: MickyAPI = {
  wakeWord: {
    getStatus: (): Promise<WakeWordStatus> => ipcRenderer.invoke('wake-word:get-status'),
    setEnabled: (enabled: boolean): Promise<WakeWordStatus> =>
      ipcRenderer.invoke('wake-word:set-enabled', enabled),
    retry: (): Promise<WakeWordStatus> => ipcRenderer.invoke('wake-word:retry'),
    activateManually: (): Promise<WakeWordStatus> =>
      ipcRenderer.invoke('wake-word:activate-manually'),
    resume: (): Promise<void> => ipcRenderer.invoke('wake-word:resume'),
    processAudio: (buffer: ArrayBuffer): void => ipcRenderer.send(AUDIO_CHUNK_CHANNEL, buffer),
    reportCaptureError: (error: string): void => ipcRenderer.send('wake-word:capture-error', error),
    onStatusChange: (listener: (status: WakeWordStatus) => void): (() => void) =>
      subscribe('wake-word:status', listener),
    onActivation: (listener: (activation: WakeWordActivation) => void): (() => void) =>
      subscribe('wake-word:activation', listener)
  },
  speech: {
    getStatus: (): Promise<SpeechStatus> => ipcRenderer.invoke('speech:get-status'),
    onStatusChange: (listener: (status: SpeechStatus) => void): (() => void) =>
      subscribe(SPEECH_STATUS_CHANNEL, listener),
    onTranscript: (listener: (transcript: SpeechTranscript) => void): (() => void) =>
      subscribe(SPEECH_TRANSCRIPT_CHANNEL, listener)
  },
  models: {
    getStatus: (): Promise<ModelsSnapshot> => ipcRenderer.invoke('models:get-status'),
    download: (modelId: string): Promise<ModelsSnapshot> =>
      ipcRenderer.invoke('models:download', modelId),
    cancel: (modelId: string): Promise<ModelsSnapshot> =>
      ipcRenderer.invoke('models:cancel', modelId),
    remove: (modelId: string): Promise<ModelsSnapshot> =>
      ipcRenderer.invoke('models:remove', modelId),
    setActive: (modelId: string): Promise<ModelsSnapshot> =>
      ipcRenderer.invoke('models:set-active', modelId),
    openCard: (url: string): Promise<void> => ipcRenderer.invoke('models:open-card', url),
    onStatusChange: (listener: (snapshot: ModelsSnapshot) => void): (() => void) =>
      subscribe(MODELS_STATUS_CHANNEL, listener)
  },
  agent: {
    getStatus: (): Promise<AgentStatus> => ipcRenderer.invoke('agent:get-status'),
    send: (text: string): Promise<void> => ipcRenderer.invoke('agent:send', text),
    abort: (): Promise<AgentStatus> => ipcRenderer.invoke('agent:abort'),
    reset: (): Promise<AgentStatus> => ipcRenderer.invoke('agent:reset'),
    onStatusChange: (listener: (status: AgentStatus) => void): (() => void) =>
      subscribe(AGENT_STATUS_CHANNEL, listener),
    onDelta: (listener: (delta: AgentDelta) => void): (() => void) =>
      subscribe(AGENT_DELTA_CHANNEL, listener)
  },
  llm: {
    getSnapshot: (): Promise<LlmSnapshot> => ipcRenderer.invoke('llm:get-snapshot'),
    setModel: (modelId: string): Promise<LlmSnapshot> =>
      ipcRenderer.invoke('llm:set-model', modelId),
    addCustomModel: (modelId: string): Promise<LlmSnapshot> =>
      ipcRenderer.invoke('llm:add-custom-model', modelId),
    removeCustomModel: (modelId: string): Promise<LlmSnapshot> =>
      ipcRenderer.invoke('llm:remove-custom-model', modelId),
    setApiKey: (apiKey: string): Promise<LlmSnapshot> =>
      ipcRenderer.invoke('llm:set-api-key', apiKey),
    clearApiKey: (): Promise<LlmSnapshot> => ipcRenderer.invoke('llm:clear-api-key'),
    refreshModels: (): Promise<LlmSnapshot> => ipcRenderer.invoke('llm:refresh-models'),
    openKeys: (): Promise<void> => ipcRenderer.invoke('llm:open-keys'),
    onSnapshotChange: (listener: (snapshot: LlmSnapshot) => void): (() => void) =>
      subscribe(LLM_SNAPSHOT_CHANNEL, listener)
  },
  soul: {
    getSnapshot: (): Promise<SoulSnapshot> => ipcRenderer.invoke('soul:get-snapshot'),
    readFile: (id: SoulFileId): Promise<string> => ipcRenderer.invoke('soul:read-file', id),
    writeFile: (id: SoulFileId, content: string): Promise<SoulSnapshot> =>
      ipcRenderer.invoke('soul:write-file', id, content),
    completeOnboarding: (draft: UserProfileDraft): Promise<SoulSnapshot> =>
      ipcRenderer.invoke('soul:complete-onboarding', draft),
    onSnapshotChange: (listener: (snapshot: SoulSnapshot) => void): (() => void) =>
      subscribe(SOUL_SNAPSHOT_CHANNEL, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
