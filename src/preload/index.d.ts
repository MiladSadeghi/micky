import { ElectronAPI } from '@electron-toolkit/preload'
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
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: MickyAPI
  }
}
