import { contextBridge, ipcRenderer } from 'electron'
import { FLYOVER_SNAPSHOT_CHANNEL, type FlyoverAPI, type FlyoverSnapshot } from '@/lib/flyover'
import { APPEARANCE_SNAPSHOT_CHANNEL, type AppearanceSnapshot } from '@/lib/settings'
import { EARCON_CHANNEL, type EarconKind } from '@/lib/earcon'

const api: FlyoverAPI = {
  getSnapshot: () => ipcRenderer.invoke('flyover:get-snapshot'),
  getAppearance: () => ipcRenderer.invoke('appearance:get-snapshot'),
  cancel: () => ipcRenderer.send('flyover:cancel'),
  finishDictation: () => ipcRenderer.send('flyover:finish-dictation'),
  startCompose: (text) => ipcRenderer.send('flyover:compose-start', text),
  updateCompose: (text) => ipcRenderer.send('flyover:compose-update', text),
  submitCompose: (text) => ipcRenderer.send('flyover:compose-submit', text),
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
  },
  onEarcon: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, kind: EarconKind): void => listener(kind)
    ipcRenderer.on(EARCON_CHANNEL, handler)
    return () => ipcRenderer.removeListener(EARCON_CHANNEL, handler)
  }
}

contextBridge.exposeInMainWorld('flyoverApi', api)
