import { contextBridge, ipcRenderer } from 'electron'
import { FLYOVER_SNAPSHOT_CHANNEL, type FlyoverAPI, type FlyoverSnapshot } from '@/lib/flyover'
import { APPEARANCE_SNAPSHOT_CHANNEL, type AppearanceSnapshot } from '@/lib/settings'

const api: FlyoverAPI = {
  getSnapshot: () => ipcRenderer.invoke('flyover:get-snapshot'),
  getAppearance: () => ipcRenderer.invoke('appearance:get-snapshot'),
  cancel: () => ipcRenderer.send('flyover:cancel'),
  finishDictation: () => ipcRenderer.send('flyover:finish-dictation'),
  resolveApproval: (approved) => ipcRenderer.send('flyover:resolve-approval', approved),
  resolveDisclosure: (accepted) => ipcRenderer.send('flyover:resolve-disclosure', accepted),
  openMain: () => ipcRenderer.send('flyover:open-main'),
  openModels: () => ipcRenderer.send('flyover:open-models'),
  onSnapshotChange: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: FlyoverSnapshot): void =>
      listener(snapshot)
    ipcRenderer.on(FLYOVER_SNAPSHOT_CHANNEL, handler)
    return () => ipcRenderer.removeListener(FLYOVER_SNAPSHOT_CHANNEL, handler)
  },
  onAppearanceChange: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: AppearanceSnapshot): void =>
      listener(snapshot)
    ipcRenderer.on(APPEARANCE_SNAPSHOT_CHANNEL, handler)
    return () => ipcRenderer.removeListener(APPEARANCE_SNAPSHOT_CHANNEL, handler)
  }
}

contextBridge.exposeInMainWorld('flyoverApi', api)
