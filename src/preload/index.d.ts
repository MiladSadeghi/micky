import { ElectronAPI } from '@electron-toolkit/preload'
import type { ModelsSnapshot, SpeechStatus, SpeechTranscript } from '../shared/asr'
import type { WakeWordActivation, WakeWordStatus } from '../shared/wake-word'

interface MickyAPI {
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
  models: {
    getStatus: () => Promise<ModelsSnapshot>
    download: (modelId: string) => Promise<ModelsSnapshot>
    cancel: (modelId: string) => Promise<ModelsSnapshot>
    remove: (modelId: string) => Promise<ModelsSnapshot>
    setActive: (modelId: string) => Promise<ModelsSnapshot>
    openCard: (url: string) => Promise<void>
    onStatusChange: (listener: (snapshot: ModelsSnapshot) => void) => () => void
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: MickyAPI
  }
}
