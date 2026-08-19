import { app, shell, BrowserWindow, ipcMain, nativeTheme } from 'electron'
import { existsSync } from 'node:fs'
import { join, sep } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { AUDIO_CHUNK_CHANNEL } from '../shared/asr'
import { isWakeWordAudioPayload } from '../shared/wake-word'
import { AudioRouter } from './audio-router'
import { ModelRegistry } from './models/registry'
import { SettingsStore } from './settings/store'
import { SpeechService } from './speech/service'
import { WakeWordService } from './wake-word/service'

const COMPANION_WIDTH = 400
const COMPANION_HEIGHT = 712
let mainWindow: BrowserWindow | null = null
let settingsStore: SettingsStore | null = null
let modelRegistry: ModelRegistry | null = null
let wakeWordService: WakeWordService | null = null
let speechService: SpeechService | null = null
let audioRouter: AudioRouter | null = null

function isTrustedSender(sender: Electron.WebContents): boolean {
  return Boolean(mainWindow && !mainWindow.isDestroyed() && sender === mainWindow.webContents)
}

function resolveUnpackedWorkerPath(fileName: string): string {
  const bundled = join(__dirname, fileName)
  const unpacked = bundled.replace(`${sep}app.asar${sep}`, `${sep}app.asar.unpacked${sep}`)
  return unpacked !== bundled && existsSync(unpacked) ? unpacked : bundled
}

function registerIpc(): void {
  ipcMain.handle('wake-word:get-status', (event) => {
    if (!isTrustedSender(event.sender)) throw new Error('Untrusted wake-word status request.')
    return wakeWordService?.getStatus()
  })
  ipcMain.handle('wake-word:set-enabled', async (event, enabled: unknown) => {
    if (!isTrustedSender(event.sender) || typeof enabled !== 'boolean') {
      throw new Error('Invalid wake-word setting.')
    }
    await settingsStore?.update({ wakeWordEnabled: enabled })
    return wakeWordService?.setEnabled(enabled)
  })
  ipcMain.handle('wake-word:retry', (event) => {
    if (!isTrustedSender(event.sender)) throw new Error('Untrusted wake-word retry request.')
    return wakeWordService?.retry()
  })
  ipcMain.handle('wake-word:activate-manually', (event) => {
    if (!isTrustedSender(event.sender)) throw new Error('Untrusted wake-word activation request.')
    return wakeWordService?.activateManually()
  })
  ipcMain.handle('wake-word:resume', (event) => {
    if (!isTrustedSender(event.sender)) throw new Error('Untrusted wake-word resume request.')
    wakeWordService?.resumeListening()
  })
  ipcMain.on(AUDIO_CHUNK_CHANNEL, (event, payload: unknown) => {
    if (isTrustedSender(event.sender) && isWakeWordAudioPayload(payload)) {
      audioRouter?.process(payload)
    }
  })
  ipcMain.on('wake-word:capture-error', (event, error: unknown) => {
    if (isTrustedSender(event.sender) && typeof error === 'string') {
      wakeWordService?.reportCaptureError(error.slice(0, 500))
    }
  })

  ipcMain.handle('speech:get-status', (event) => {
    if (!isTrustedSender(event.sender)) throw new Error('Untrusted speech status request.')
    return speechService?.getStatus()
  })

  ipcMain.handle('models:get-status', (event) => {
    if (!isTrustedSender(event.sender)) throw new Error('Untrusted models status request.')
    return modelRegistry?.getSnapshot()
  })
  ipcMain.handle('models:download', async (event, modelId: unknown) => {
    if (!isTrustedSender(event.sender) || typeof modelId !== 'string') {
      throw new Error('Invalid model download request.')
    }
    return modelRegistry?.download(modelId)
  })
  ipcMain.handle('models:cancel', (event, modelId: unknown) => {
    if (!isTrustedSender(event.sender) || typeof modelId !== 'string') {
      throw new Error('Invalid model cancel request.')
    }
    return modelRegistry?.cancel(modelId)
  })
  ipcMain.handle('models:remove', async (event, modelId: unknown) => {
    if (!isTrustedSender(event.sender) || typeof modelId !== 'string') {
      throw new Error('Invalid model remove request.')
    }
    return modelRegistry?.remove(modelId)
  })
  ipcMain.handle('models:set-active', async (event, modelId: unknown) => {
    if (!isTrustedSender(event.sender) || typeof modelId !== 'string') {
      throw new Error('Invalid model selection.')
    }
    return modelRegistry?.setActive(modelId)
  })
  ipcMain.handle('models:open-card', async (event, url: unknown) => {
    if (!isTrustedSender(event.sender) || typeof url !== 'string') {
      throw new Error('Invalid model card request.')
    }
    if (!url.startsWith('https://huggingface.co/')) {
      throw new Error('Only Hugging Face model cards can be opened.')
    }
    await shell.openExternal(url)
  })
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: COMPANION_WIDTH,
    height: COMPANION_HEIGHT,
    minWidth: 360,
    minHeight: 640,
    maxWidth: 480,
    show: false,
    center: true,
    title: 'میکی',
    autoHideMenuBar: true,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: '#00000000',
    ...(process.platform === 'darwin'
      ? {
          vibrancy: 'under-window' as const,
          visualEffectState: 'active' as const,
          titleBarStyle: 'hidden' as const,
          trafficLightPosition: { x: 12, y: 11 },
          titleBarOverlay: { height: 36 }
        }
      : {}),
    ...(process.platform === 'win32'
      ? {
          backgroundMaterial: 'acrylic' as const,
          titleBarStyle: 'hidden' as const,
          titleBarOverlay: {
            color: '#121211',
            symbolColor: '#e1e0cc',
            height: 36
          }
        }
      : {}),
    ...(process.platform === 'linux'
      ? {
          icon,
          titleBarStyle: 'hidden' as const,
          titleBarOverlay: {
            color: '#121211',
            symbolColor: '#e1e0cc',
            height: 36
          }
        }
      : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  mainWindow = window

  window.setAspectRatio(COMPANION_WIDTH / COMPANION_HEIGHT)

  window.on('ready-to-show', () => {
    window.show()
  })

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== window.webContents.getURL()) event.preventDefault()
  })
  window.webContents.session.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      const mediaTypes = permission === 'media' && 'mediaTypes' in details ? details.mediaTypes : []
      const audioOnly =
        permission === 'media' && mediaTypes?.includes('audio') && !mediaTypes.includes('video')
      callback(Boolean(webContents === window.webContents && audioOnly))
    }
  )
  window.webContents.session.setPermissionCheckHandler(
    (webContents, permission, _requestingOrigin, details) => {
      const audioOnly =
        permission === 'media' && 'mediaType' in details && details.mediaType === 'audio'
      return Boolean(webContents === window.webContents && audioOnly)
    }
  )
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  startRuntime()
}

function startRuntime(): void {
  const wakeWordResourcesRoot = is.dev
    ? join(app.getAppPath(), 'resources', 'wakeword')
    : join(process.resourcesPath, 'wakeword')

  wakeWordService?.dispose()
  speechService?.dispose()

  const settings = settingsStore?.get()
  audioRouter = new AudioRouter(
    () => wakeWordService,
    () => speechService
  )
  speechService = new SpeechService({
    scriptPath: resolveUnpackedWorkerPath('asr-process.js'),
    models: modelRegistry!,
    settings: settingsStore!,
    getWindow: () => mainWindow,
    getPreroll: () => audioRouter?.takePreroll() ?? new ArrayBuffer(0),
    onSessionEnd: () => wakeWordService?.resumeListening()
  })
  wakeWordService = new WakeWordService({
    workerScript: resolveUnpackedWorkerPath('wake-word-worker.js'),
    resources: {
      melModelPath: join(wakeWordResourcesRoot, 'melspectrogram.onnx'),
      embeddingModelPath: join(wakeWordResourcesRoot, 'embedding_model.onnx'),
      classifierModelPath: join(wakeWordResourcesRoot, 'hey_nimruz.onnx')
    },
    getWindow: () => mainWindow,
    enabled: settings?.wakeWordEnabled,
    onActivated: () => {
      void speechService?.startSession()
    },
    onResume: () => speechService?.cancelSession()
  })
  wakeWordService.initialize()
  void speechService.preload()
}

app.whenReady().then(async () => {
  nativeTheme.themeSource = 'dark'
  electronApp.setAppUserModelId('dev.micky.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  settingsStore = new SettingsStore(app.getPath('userData'))
  await settingsStore.load()
  modelRegistry = new ModelRegistry({
    modelsRoot: join(app.getPath('userData'), 'models'),
    settings: settingsStore,
    getWindow: () => mainWindow,
    isSessionActive: () => Boolean(speechService?.isSessionActive()),
    onActiveModelChange: (modelId) => {
      if (!speechService) return
      if (!modelId) {
        speechService.dispose()
        return
      }
      void speechService.preload()
    }
  })
  await modelRegistry.initialize()

  registerIpc()
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  wakeWordService?.dispose()
  speechService?.dispose()
  wakeWordService = null
  speechService = null
  audioRouter = null
})
