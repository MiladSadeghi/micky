import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { WakeWordActivation, WakeWordStatus } from '../shared/wake-word'

// Custom APIs for renderer
const api = {
  wakeWord: {
    getStatus: (): Promise<WakeWordStatus> => ipcRenderer.invoke('wake-word:get-status'),
    setEnabled: (enabled: boolean): Promise<WakeWordStatus> =>
      ipcRenderer.invoke('wake-word:set-enabled', enabled),
    retry: (): Promise<WakeWordStatus> => ipcRenderer.invoke('wake-word:retry'),
    activateManually: (): Promise<WakeWordStatus> =>
      ipcRenderer.invoke('wake-word:activate-manually'),
    resume: (): Promise<void> => ipcRenderer.invoke('wake-word:resume'),
    processAudio: (buffer: ArrayBuffer): void => ipcRenderer.send('wake-word:audio', buffer),
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
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
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
