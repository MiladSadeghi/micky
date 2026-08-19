import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  AUDIO_CHUNK_CHANNEL,
  MODELS_STATUS_CHANNEL,
  SPEECH_STATUS_CHANNEL,
  SPEECH_TRANSCRIPT_CHANNEL,
  type ModelsSnapshot,
  type SpeechStatus,
  type SpeechTranscript
} from '../shared/asr'
import type { WakeWordActivation, WakeWordStatus } from '../shared/wake-word'

const api = {
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
    onStatusChange: (listener: (status: WakeWordStatus) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, status: WakeWordStatus): void =>
        listener(status)
      ipcRenderer.on('wake-word:status', handler)
      return () => ipcRenderer.removeListener('wake-word:status', handler)
    },
    onActivation: (listener: (activation: WakeWordActivation) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, activation: WakeWordActivation): void =>
        listener(activation)
      ipcRenderer.on('wake-word:activation', handler)
      return () => ipcRenderer.removeListener('wake-word:activation', handler)
    }
  },
  speech: {
    getStatus: (): Promise<SpeechStatus> => ipcRenderer.invoke('speech:get-status'),
    onStatusChange: (listener: (status: SpeechStatus) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, status: SpeechStatus): void =>
        listener(status)
      ipcRenderer.on(SPEECH_STATUS_CHANNEL, handler)
      return () => ipcRenderer.removeListener(SPEECH_STATUS_CHANNEL, handler)
    },
    onTranscript: (listener: (transcript: SpeechTranscript) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, transcript: SpeechTranscript): void =>
        listener(transcript)
      ipcRenderer.on(SPEECH_TRANSCRIPT_CHANNEL, handler)
      return () => ipcRenderer.removeListener(SPEECH_TRANSCRIPT_CHANNEL, handler)
    }
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
    onStatusChange: (listener: (snapshot: ModelsSnapshot) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, snapshot: ModelsSnapshot): void =>
        listener(snapshot)
      ipcRenderer.on(MODELS_STATUS_CHANNEL, handler)
      return () => ipcRenderer.removeListener(MODELS_STATUS_CHANNEL, handler)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
