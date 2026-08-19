import { app, shell, BrowserWindow, ipcMain, nativeImage, nativeTheme } from 'electron'
import { existsSync } from 'node:fs'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { INITIAL_AGENT_STATUS } from '@/lib/agent'
import { AUDIO_CHUNK_CHANNEL } from '@/lib/asr'
import { OPENROUTER_KEYS_URL } from '@/lib/llm'
import {
  SOUL_SNAPSHOT_CHANNEL,
  type SoulFileId,
  type SoulSnapshot,
  type UserProfileDraft
} from '@/lib/soul'
import { isWakeWordAudioPayload } from '@/lib/wake-word'
import { AgentService } from './agent/service'
import { AudioRouter } from './audio-router'
import { ConversationController } from './conversation/controller'
import { LlmService } from './llm/service'
import { SecretStore } from './llm/secrets'
import { ModelRegistry } from './models/registry'
import { SettingsStore } from './settings/store'
import { SpeechService } from './speech/service'
import { SoulStore } from './soul/store'
import { WakeWordService } from './wake-word/service'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RENDERER_DEV_URL = process.env.ELECTRON_RENDERER_URL
const COMPANION_WIDTH = 400
const COMPANION_HEIGHT = 712
let mainWindow: BrowserWindow | null = null
let settingsStore: SettingsStore | null = null
let modelRegistry: ModelRegistry | null = null
let secretStore: SecretStore | null = null
let soulStore: SoulStore | null = null
let llmService: LlmService | null = null
let agentService: AgentService | null = null
let conversation: ConversationController | null = null
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

function resolveAppIcon(): Electron.NativeImage | undefined {
  const candidates = [
    join(__dirname, '../assets/icon.png'),
    join(app.getAppPath(), 'assets/icon.png')
  ]
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue
    const image = nativeImage.createFromPath(candidate)
    if (!image.isEmpty()) return image
  }
  return undefined
}

async function getSoulSnapshot(): Promise<SoulSnapshot> {
  const files = soulStore ? await soulStore.readAll() : { soul: '', user: '', memory: '' }
  return {
    onboardingCompleted: settingsStore?.get().onboardingCompleted === true,
    files
  }
}

async function emitSoulSnapshot(): Promise<SoulSnapshot> {
  const snapshot = await getSoulSnapshot()
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(SOUL_SNAPSHOT_CHANNEL, snapshot)
  }
  return snapshot
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

  ipcMain.handle('agent:get-status', (event) => {
    if (!isTrustedSender(event.sender)) throw new Error('Untrusted agent status request.')
    return agentService?.getStatus() ?? INITIAL_AGENT_STATUS
  })
  ipcMain.handle('agent:send', async (event, text: unknown) => {
    if (!isTrustedSender(event.sender) || typeof text !== 'string') {
      throw new Error('Invalid agent message.')
    }
    conversation?.sendText(text.slice(0, 4_000))
  })
  ipcMain.handle('agent:abort', (event) => {
    if (!isTrustedSender(event.sender)) throw new Error('Untrusted agent abort request.')
    conversation?.onWakeResume()
    agentService?.abort()
    return agentService?.getStatus() ?? INITIAL_AGENT_STATUS
  })
  ipcMain.handle('agent:reset', (event) => {
    if (!isTrustedSender(event.sender)) throw new Error('Untrusted agent reset request.')
    conversation?.dispose()
    return agentService?.reset() ?? INITIAL_AGENT_STATUS
  })

  ipcMain.handle('llm:get-snapshot', (event) => {
    if (!isTrustedSender(event.sender)) throw new Error('Untrusted llm snapshot request.')
    return llmService?.getSnapshot()
  })
  ipcMain.handle('llm:set-model', async (event, modelId: unknown) => {
    if (!isTrustedSender(event.sender) || typeof modelId !== 'string') {
      throw new Error('Invalid model selection.')
    }
    return llmService?.setModel(modelId)
  })
  ipcMain.handle('llm:add-custom-model', async (event, modelId: unknown) => {
    if (!isTrustedSender(event.sender) || typeof modelId !== 'string') {
      throw new Error('Invalid custom model.')
    }
    return llmService?.addCustomModel(modelId)
  })
  ipcMain.handle('llm:remove-custom-model', async (event, modelId: unknown) => {
    if (!isTrustedSender(event.sender) || typeof modelId !== 'string') {
      throw new Error('Invalid custom model.')
    }
    return llmService?.removeCustomModel(modelId)
  })
  ipcMain.handle('llm:set-api-key', async (event, apiKey: unknown) => {
    if (!isTrustedSender(event.sender) || typeof apiKey !== 'string') {
      throw new Error('Invalid API key.')
    }
    return llmService?.setApiKey(apiKey.slice(0, 256))
  })
  ipcMain.handle('llm:clear-api-key', async (event) => {
    if (!isTrustedSender(event.sender)) throw new Error('Untrusted API key request.')
    return llmService?.clearApiKey()
  })
  ipcMain.handle('llm:refresh-models', async (event) => {
    if (!isTrustedSender(event.sender)) throw new Error('Untrusted llm refresh request.')
    return llmService?.refresh()
  })
  ipcMain.handle('llm:open-keys', async (event) => {
    if (!isTrustedSender(event.sender)) throw new Error('Untrusted keys request.')
    await shell.openExternal(OPENROUTER_KEYS_URL)
  })

  ipcMain.handle('soul:get-snapshot', async (event) => {
    if (!isTrustedSender(event.sender)) throw new Error('Untrusted soul snapshot request.')
    return getSoulSnapshot()
  })
  ipcMain.handle('soul:read-file', async (event, id: unknown) => {
    if (!isTrustedSender(event.sender)) throw new Error('Untrusted soul read request.')
    return soulStore?.read(asSoulFileId(id))
  })
  ipcMain.handle('soul:write-file', async (event, id: unknown, content: unknown) => {
    if (!isTrustedSender(event.sender) || typeof content !== 'string') {
      throw new Error('Invalid soul write request.')
    }
    await soulStore?.write(asSoulFileId(id), content.slice(0, 20_000))
    return emitSoulSnapshot()
  })
  ipcMain.handle('soul:complete-onboarding', async (event, draft: unknown) => {
    if (!isTrustedSender(event.sender)) throw new Error('Untrusted onboarding request.')
    await soulStore?.writeUserProfile(asUserProfileDraft(draft))
    await settingsStore?.update({ onboardingCompleted: true })
    return emitSoulSnapshot()
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
          icon: resolveAppIcon(),
          titleBarStyle: 'hidden' as const,
          titleBarOverlay: {
            color: '#121211',
            symbolColor: '#e1e0cc',
            height: 36
          }
        }
      : {}),
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
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

  if (RENDERER_DEV_URL) {
    void window.loadURL(RENDERER_DEV_URL)
  } else {
    void window.loadFile(join(__dirname, '../dist/index.html'))
  }

  startRuntime()
}

function startRuntime(): void {
  const wakeWordResourcesRoot = app.isPackaged
    ? join(process.resourcesPath, 'wakeword')
    : join(app.getAppPath(), 'assets', 'wakeword')

  wakeWordService?.dispose()
  speechService?.dispose()
  conversation?.dispose()

  const settings = settingsStore?.get()
  audioRouter = new AudioRouter(
    () => wakeWordService,
    () => speechService
  )
  speechService = new SpeechService({
    scriptPath: resolveUnpackedWorkerPath('asr-process.cjs'),
    models: modelRegistry!,
    settings: settingsStore!,
    getWindow: () => mainWindow,
    getPreroll: () => audioRouter?.takePreroll() ?? new ArrayBuffer(0),
    onSessionEnd: () => conversation?.onSpeechSessionEnd(),
    onFinalTranscript: (text) => conversation?.onFinalTranscript(text)
  })
  wakeWordService = new WakeWordService({
    workerScript: resolveUnpackedWorkerPath('wake-word-worker.cjs'),
    resources: {
      melModelPath: join(wakeWordResourcesRoot, 'melspectrogram.onnx'),
      embeddingModelPath: join(wakeWordResourcesRoot, 'embedding_model.onnx'),
      classifierModelPath: join(wakeWordResourcesRoot, 'hey_micky.onnx')
    },
    getWindow: () => mainWindow,
    enabled: settings?.wakeWordEnabled,
    onActivated: () => {
      conversation?.onWakeActivated()
      void speechService?.startSession()
    },
    onResume: () => {
      conversation?.onWakeResume()
      speechService?.cancelSession()
    }
  })
  wakeWordService.initialize()
  void speechService.preload()
}

app.whenReady().then(async () => {
  nativeTheme.themeSource = 'dark'
  if (process.platform === 'win32') {
    app.setAppUserModelId('dev.micky.app')
  }

  settingsStore = new SettingsStore(app.getPath('userData'))
  await settingsStore.load()
  secretStore = new SecretStore(app.getPath('userData'))
  await secretStore.load()
  soulStore = new SoulStore(app.getPath('userData'))
  await soulStore.initialize()
  llmService = new LlmService({
    settings: settingsStore,
    secrets: secretStore,
    getWindow: () => mainWindow
  })
  await llmService.refresh()
  agentService = new AgentService({
    settings: settingsStore,
    llm: llmService,
    soul: soulStore,
    getWindow: () => mainWindow
  })
  conversation = new ConversationController({
    settings: settingsStore,
    llm: llmService,
    getAgent: () => agentService,
    getSpeech: () => speechService,
    getWakeWord: () => wakeWordService
  })
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
  conversation?.dispose()
  agentService?.abort()
  wakeWordService?.dispose()
  speechService?.dispose()
  conversation = null
  agentService = null
  wakeWordService = null
  speechService = null
  audioRouter = null
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asSoulFileId(value: unknown): SoulFileId {
  if (value === 'soul' || value === 'user' || value === 'memory') return value
  throw new Error('Invalid soul file.')
}

function asUserProfileDraft(value: unknown): UserProfileDraft {
  const record = isRecord(value) ? value : {}
  return {
    name: readString(record.name, 80),
    addressForm: record.addressForm === 'shoma' ? 'shoma' : 'to',
    languageMix: record.languageMix === 'persian' ? 'persian' : 'mixed',
    city: readString(record.city, 80),
    work: readString(record.work, 120),
    focus: readString(record.focus, 160),
    replyLength: record.replyLength === 'medium' ? 'medium' : 'short'
  }
}

function readString(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}
