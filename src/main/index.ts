import { app, shell, BrowserWindow, ipcMain, nativeTheme } from 'electron'
import { existsSync } from 'node:fs'
import { join, sep } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { isWakeWordAudioPayload } from '../shared/wake-word'
import { WakeWordService } from './wake-word/service'

const COMPANION_WIDTH = 400
const COMPANION_HEIGHT = 712
let mainWindow: BrowserWindow | null = null
let wakeWordService: WakeWordService | null = null

function isTrustedSender(sender: Electron.WebContents): boolean {
  return Boolean(mainWindow && !mainWindow.isDestroyed() && sender === mainWindow.webContents)
}

function resolveUnpackedWorkerPath(fileName: string): string {
  const bundled = join(__dirname, fileName)
  const unpacked = bundled.replace(`${sep}app.asar${sep}`, `${sep}app.asar.unpacked${sep}`)
  return unpacked !== bundled && existsSync(unpacked) ? unpacked : bundled
}

function registerWakeWordIpc(): void {
  ipcMain.handle('wake-word:get-status', (event) => {
    if (!isTrustedSender(event.sender)) throw new Error('Untrusted wake-word status request.')
    return wakeWordService?.getStatus()
  })
  ipcMain.handle('wake-word:set-enabled', (event, enabled: unknown) => {
    if (!isTrustedSender(event.sender) || typeof enabled !== 'boolean') {
      throw new Error('Invalid wake-word setting.')
    }
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
  ipcMain.on('wake-word:audio', (event, payload: unknown) => {
    if (isTrustedSender(event.sender) && isWakeWordAudioPayload(payload)) {
      wakeWordService?.processAudio(payload)
    }
  })
  ipcMain.on('wake-word:capture-error', (event, error: unknown) => {
    if (isTrustedSender(event.sender) && typeof error === 'string') {
      wakeWordService?.reportCaptureError(error.slice(0, 500))
    }
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

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  const wakeWordResourcesRoot = is.dev
    ? join(app.getAppPath(), 'resources', 'wakeword')
    : join(process.resourcesPath, 'wakeword')
  wakeWordService?.dispose()
  wakeWordService = new WakeWordService({
    workerScript: resolveUnpackedWorkerPath('wake-word-worker.js'),
    resources: {
      melModelPath: join(wakeWordResourcesRoot, 'melspectrogram.onnx'),
      embeddingModelPath: join(wakeWordResourcesRoot, 'embedding_model.onnx'),
      classifierModelPath: join(wakeWordResourcesRoot, 'hey_nimruz.onnx')
    },
    getWindow: () => mainWindow
  })
  wakeWordService.initialize()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Keep the native titlebar and vibrancy material on the dark palette.
  nativeTheme.themeSource = 'dark'
  // Set app user model id for windows
  electronApp.setAppUserModelId('dev.micky.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerWakeWordIpc()

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  wakeWordService?.dispose()
  wakeWordService = null
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
