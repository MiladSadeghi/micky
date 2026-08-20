import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  nativeImage,
  nativeTheme,
  Menu,
  screen,
  Tray,
  globalShortcut
} from 'electron'
import { existsSync } from 'node:fs'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { agentStatusLabel, INITIAL_AGENT_STATUS, type AgentStatus } from '@/lib/agent'
import { INITIAL_CONVERSATION_STATUS, type ConversationStatus } from '@/lib/conversation'
import { AUDIO_CHUNK_CHANNEL } from '@/lib/asr'
import { OPENROUTER_KEYS_URL, isLlmProviderId, isOpenAiCompatibleProviderId } from '@/lib/llm'
import { SETTINGS_SNAPSHOT_CHANNEL, toSettingsSnapshot } from '@/lib/settings'
import type { SpeechSessionMode } from '@/lib/asr'
import {
  ELEVENLABS_KEYS_URL,
  GEMINI_KEYS_URL,
  INITIAL_TTS_STATUS,
  type TtsProviderId
} from '@/lib/tts'
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
import { TtsService } from './tts/service'
import { DictationController } from './dictation/controller'
import { FlyoverService } from './flyover/service'
import { shouldShowWakeFlyover } from './flyover/activation'
import { ShortcutService, type ShortcutKind } from './shortcuts/service'
import { VisionService } from './vision/service'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RENDERER_DEV_URL = process.env.ELECTRON_RENDERER_URL
const COMPANION_WIDTH = 400
const COMPANION_HEIGHT = 712
const SETTINGS_WIDTH = 760
const SETTINGS_HEIGHT = 712
type MainWindowMode = 'home' | 'settings'
let mainWindow: BrowserWindow | null = null
let flyoverWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let shortcutError: string | null = null
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
let ttsService: TtsService | null = null
let flyoverService: FlyoverService | null = null
let shortcutService: ShortcutService | null = null
let dictationController: DictationController | null = null
let visionService: VisionService | null = null
let assistantFlyoverActive = false
let assistantShortcutSilent = false

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
app.commandLine.appendSwitch('enable-features', 'GlobalShortcutsPortal')

function isTrustedSender(sender: Electron.WebContents): boolean {
  return Boolean(mainWindow && !mainWindow.isDestroyed() && sender === mainWindow.webContents)
}

function isTrustedFlyoverSender(sender: Electron.WebContents): boolean {
  return Boolean(
    flyoverWindow && !flyoverWindow.isDestroyed() && sender === flyoverWindow.webContents
  )
}

function showMainWindow(openSettings = false): void {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow()
  const window = mainWindow
  if (!window) return
  if (openSettings) setMainWindowMode('settings')
  window.show()
  window.focus()
  if (openSettings) window.webContents.send('app:open-settings')
}

function setMainWindowMode(mode: MainWindowMode): void {
  const window = mainWindow
  if (!window || window.isDestroyed()) return

  const currentBounds = window.getBounds()
  const workArea = screen.getDisplayMatching(currentBounds).workArea
  const desiredWidth = mode === 'settings' ? SETTINGS_WIDTH : COMPANION_WIDTH
  const desiredHeight = mode === 'settings' ? SETTINGS_HEIGHT : COMPANION_HEIGHT
  const width = Math.min(desiredWidth, workArea.width)
  const height = Math.min(desiredHeight, workArea.height)
  const x = Math.min(
    Math.max(Math.round(currentBounds.x + (currentBounds.width - width) / 2), workArea.x),
    workArea.x + workArea.width - width
  )
  const y = Math.min(
    Math.max(Math.round(currentBounds.y + (currentBounds.height - height) / 2), workArea.y),
    workArea.y + workArea.height - height
  )

  window.setAspectRatio(0)
  if (mode === 'settings') {
    window.setMaximumSize(960, 900)
    window.setMinimumSize(Math.min(640, width), Math.min(640, height))
  } else {
    window.setMinimumSize(360, Math.min(640, height))
    window.setMaximumSize(480, 900)
  }
  window.setBounds({ x, y, width, height }, true)
  if (mode === 'home') window.setAspectRatio(COMPANION_WIDTH / COMPANION_HEIGHT)
}

function positionFlyover(window: BrowserWindow): void {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const [width] = window.getSize()
  const area = process.platform === 'darwin' ? display.bounds : display.workArea
  const x = Math.round(area.x + (area.width - width) / 2)
  const y = process.platform === 'darwin' ? display.bounds.y + 6 : display.workArea.y + 10
  window.setPosition(x, y, false)
}

function emitSettingsSnapshot(): void {
  if (!settingsStore) return
  const snapshot = toSettingsSnapshot(settingsStore.get(), shortcutError)
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(SETTINGS_SNAPSHOT_CHANNEL, snapshot)
  }
}

async function setLaunchAtLogin(enabled: boolean): Promise<void> {
  if (process.platform !== 'linux') {
    app.setLoginItemSettings({ openAtLogin: enabled, args: enabled ? ['--hidden'] : [] })
    return
  }
  const autostartDir = join(app.getPath('appData'), 'autostart')
  const desktopFile = join(autostartDir, 'micky.desktop')
  if (!enabled) {
    try {
      await unlink(desktopFile)
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
    }
    return
  }
  await mkdir(autostartDir, { recursive: true })
  const appArgument = app.isPackaged ? '' : ` "${app.getAppPath().replaceAll('"', '\\"')}"`
  const executable = process.execPath.replaceAll('"', '\\"')
  await writeFile(
    desktopFile,
    `[Desktop Entry]\nType=Application\nName=Micky\nExec="${executable}"${appArgument} --hidden\nTerminal=false\nX-GNOME-Autostart-enabled=true\n`,
    'utf8'
  )
}

function resolveUnpackedWorkerPath(fileName: string): string {
  const bundled = join(__dirname, fileName)
  const unpacked = bundled.replace(`${sep}app.asar${sep}`, `${sep}app.asar.unpacked${sep}`)
  return unpacked !== bundled && existsSync(unpacked) ? unpacked : bundled
}

function resolveAppIcon(): Electron.NativeImage | undefined {
  return resolveAssetImage('icon.png')
}

function resolveTrayIcon(): Electron.NativeImage | undefined {
  return resolveAssetImage(process.platform === 'darwin' ? 'trayTemplate.png' : 'tray.png')
}

function resolveAssetImage(fileName: string): Electron.NativeImage | undefined {
  const candidates = [
    join(__dirname, '../assets', fileName),
    join(app.getAppPath(), 'assets', fileName)
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
  ipcMain.handle('app:set-window-mode', (event, mode: unknown) => {
    if (!isTrustedSender(event.sender) || (mode !== 'home' && mode !== 'settings')) {
      throw new Error('Invalid window mode.')
    }
    setMainWindowMode(mode)
  })

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

  ipcMain.handle('tts:get-status', (event) => {
    if (!isTrustedSender(event.sender)) throw new Error('Untrusted TTS status request.')
    return ttsService?.getStatus() ?? INITIAL_TTS_STATUS
  })
  ipcMain.handle('tts:get-snapshot', (event) => {
    if (!isTrustedSender(event.sender)) throw new Error('Untrusted TTS snapshot request.')
    return ttsService?.getSnapshot()
  })
  ipcMain.handle('tts:set-enabled', async (event, enabled: unknown) => {
    if (!isTrustedSender(event.sender) || typeof enabled !== 'boolean') {
      throw new Error('Invalid TTS setting.')
    }
    return ttsService?.setEnabled(enabled)
  })
  ipcMain.handle('tts:set-provider', async (event, providerId: unknown) => {
    if (!isTrustedSender(event.sender)) throw new Error('Untrusted TTS provider request.')
    return ttsService?.setProvider(asTtsProviderId(providerId))
  })
  ipcMain.handle('tts:set-voice', async (event, providerId: unknown, voiceId: unknown) => {
    if (!isTrustedSender(event.sender) || typeof voiceId !== 'string') {
      throw new Error('Invalid TTS voice.')
    }
    return ttsService?.setVoice(asTtsProviderId(providerId), voiceId)
  })
  ipcMain.handle('tts:set-api-key', async (event, providerId: unknown, apiKey: unknown) => {
    if (!isTrustedSender(event.sender) || typeof apiKey !== 'string') {
      throw new Error('Invalid TTS API key.')
    }
    return ttsService?.setApiKey(asTtsProviderId(providerId), apiKey.slice(0, 256))
  })
  ipcMain.handle('tts:clear-api-key', async (event, providerId: unknown) => {
    if (!isTrustedSender(event.sender)) throw new Error('Untrusted TTS API key request.')
    return ttsService?.clearApiKey(asTtsProviderId(providerId))
  })
  ipcMain.handle('tts:refresh-voices', async (event) => {
    if (!isTrustedSender(event.sender)) throw new Error('Untrusted TTS refresh request.')
    return ttsService?.refresh()
  })
  ipcMain.handle('tts:preview', async (event) => {
    if (!isTrustedSender(event.sender)) throw new Error('Untrusted TTS preview request.')
    return ttsService?.speak('سلام، من میکی‌ام. چه کاری برات انجام بدم؟')
  })
  ipcMain.handle('tts:open-keys', async (event, providerId: unknown) => {
    if (!isTrustedSender(event.sender)) throw new Error('Untrusted TTS keys request.')
    const provider = asTtsProviderId(providerId)
    await shell.openExternal(provider === 'gemini' ? GEMINI_KEYS_URL : ELEVENLABS_KEYS_URL)
  })
  ipcMain.on('tts:playback-finished', (event, id: unknown, error: unknown) => {
    if (!isTrustedSender(event.sender) || typeof id !== 'string') return
    ttsService?.finishPlayback(id, typeof error === 'string' ? error : undefined)
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

  ipcMain.handle('conversation:get-status', (event) => {
    if (!isTrustedSender(event.sender)) throw new Error('Untrusted conversation status request.')
    return conversation?.getStatus() ?? INITIAL_CONVERSATION_STATUS
  })
  ipcMain.on('conversation:resolve-approval', (event, approved: unknown) => {
    if (!isTrustedSender(event.sender) || typeof approved !== 'boolean') return
    conversation?.resolveApproval(approved)
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
    if (conversation) conversation.startFresh()
    else agentService?.reset()
    return agentService?.getStatus() ?? INITIAL_AGENT_STATUS
  })

  ipcMain.handle('settings:get-snapshot', (event) => {
    if (!isTrustedSender(event.sender)) throw new Error('Untrusted settings request.')
    return settingsStore ? toSettingsSnapshot(settingsStore.get(), shortcutError) : null
  })
  ipcMain.handle('settings:set-system-tools', async (event, enabled: unknown) => {
    if (!isTrustedSender(event.sender) || typeof enabled !== 'boolean') {
      throw new Error('Invalid system tools setting.')
    }
    const settings = await settingsStore?.update({ systemToolsEnabled: enabled })
    const snapshot = settings ? toSettingsSnapshot(settings, shortcutError) : null
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(SETTINGS_SNAPSHOT_CHANNEL, snapshot)
    }
    return snapshot
  })
  ipcMain.handle('settings:set-shortcut', async (event, kind: unknown, accelerator: unknown) => {
    if (
      !isTrustedSender(event.sender) ||
      (kind !== 'assistant' && kind !== 'dictation') ||
      typeof accelerator !== 'string'
    ) {
      throw new Error('Invalid shortcut setting.')
    }
    await shortcutService?.replace(kind as ShortcutKind, accelerator.slice(0, 80))
    emitSettingsSnapshot()
    return settingsStore ? toSettingsSnapshot(settingsStore.get(), shortcutError) : null
  })
  ipcMain.handle('settings:set-dictation-cleanup', async (event, enabled: unknown) => {
    if (!isTrustedSender(event.sender) || typeof enabled !== 'boolean')
      throw new Error('Invalid dictation setting.')
    await settingsStore?.update({ dictationAiCleanup: enabled })
    emitSettingsSnapshot()
    return settingsStore ? toSettingsSnapshot(settingsStore.get(), shortcutError) : null
  })
  ipcMain.handle('settings:set-dictation-auto-paste', async (event, enabled: unknown) => {
    if (!isTrustedSender(event.sender) || typeof enabled !== 'boolean')
      throw new Error('Invalid dictation setting.')
    await settingsStore?.update({ dictationAutoPaste: enabled })
    emitSettingsSnapshot()
    return settingsStore ? toSettingsSnapshot(settingsStore.get(), shortcutError) : null
  })
  ipcMain.handle('settings:set-launch-at-login', async (event, enabled: unknown) => {
    if (!isTrustedSender(event.sender) || typeof enabled !== 'boolean')
      throw new Error('Invalid login setting.')
    await setLaunchAtLogin(enabled)
    await settingsStore?.update({ launchAtLogin: enabled })
    emitSettingsSnapshot()
    return settingsStore ? toSettingsSnapshot(settingsStore.get(), shortcutError) : null
  })
  ipcMain.handle('settings:set-vision-model', async (event, modelId: unknown) => {
    if (!isTrustedSender(event.sender) || typeof modelId !== 'string')
      throw new Error('Invalid vision model.')
    await llmService?.setVisionModel(modelId.slice(0, 160))
    emitSettingsSnapshot()
    return settingsStore ? toSettingsSnapshot(settingsStore.get(), shortcutError) : null
  })

  ipcMain.handle('llm:get-snapshot', (event) => {
    if (!isTrustedSender(event.sender)) throw new Error('Untrusted llm snapshot request.')
    return llmService?.getSnapshot()
  })
  ipcMain.handle('llm:set-provider', async (event, providerId: unknown) => {
    if (!isTrustedSender(event.sender) || !isLlmProviderId(providerId)) {
      throw new Error('Invalid LLM provider.')
    }
    return llmService?.setProvider(providerId)
  })
  ipcMain.handle('llm:set-base-url', async (event, providerId: unknown, baseUrl: unknown) => {
    if (
      !isTrustedSender(event.sender) ||
      !isLlmProviderId(providerId) ||
      !isOpenAiCompatibleProviderId(providerId) ||
      typeof baseUrl !== 'string'
    ) {
      throw new Error('Invalid LLM base URL.')
    }
    return llmService?.setBaseUrl(providerId, baseUrl.slice(0, 2_048))
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
  ipcMain.handle('llm:set-api-key', async (event, providerId: unknown, apiKey: unknown) => {
    if (
      !isTrustedSender(event.sender) ||
      !isLlmProviderId(providerId) ||
      typeof apiKey !== 'string'
    ) {
      throw new Error('Invalid API key.')
    }
    return llmService?.setApiKey(providerId, apiKey.slice(0, 256))
  })
  ipcMain.handle('llm:clear-api-key', async (event, providerId: unknown) => {
    if (!isTrustedSender(event.sender) || !isLlmProviderId(providerId)) {
      throw new Error('Untrusted API key request.')
    }
    return llmService?.clearApiKey(providerId)
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

  ipcMain.handle('flyover:get-snapshot', (event) => {
    if (!isTrustedFlyoverSender(event.sender)) throw new Error('Untrusted flyover request.')
    return flyoverService?.getSnapshot()
  })
  ipcMain.on('flyover:cancel', (event) => {
    if (!isTrustedFlyoverSender(event.sender)) return
    dictationController?.cancel()
    conversation?.onWakeResume()
    speechService?.cancelSession()
    flyoverService?.hide()
  })
  ipcMain.on('flyover:finish-dictation', (event) => {
    if (isTrustedFlyoverSender(event.sender)) dictationController?.finish()
  })
  ipcMain.on('flyover:resolve-approval', (event, approved: unknown) => {
    if (isTrustedFlyoverSender(event.sender) && typeof approved === 'boolean') {
      conversation?.resolveApproval(approved)
    }
  })
  ipcMain.on('flyover:resolve-disclosure', (event, accepted: unknown) => {
    if (isTrustedFlyoverSender(event.sender) && typeof accepted === 'boolean') {
      flyoverService?.resolveDisclosure(accepted)
    }
  })
  ipcMain.on('flyover:open-main', (event) => {
    if (isTrustedFlyoverSender(event.sender)) showMainWindow()
  })
}

function createWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    showMainWindow()
    return
  }
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
    ...(process.platform !== 'darwin' ? { icon: resolveAppIcon() } : {}),
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
    if (!process.argv.includes('--hidden')) window.show()
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
  window.on('close', (event) => {
    if (isQuitting) return
    event.preventDefault()
    window.hide()
  })
  window.on('closed', () => {
    ttsService?.stop()
    if (mainWindow === window) mainWindow = null
  })

  if (RENDERER_DEV_URL) {
    void window.loadURL(RENDERER_DEV_URL)
  } else {
    void window.loadFile(join(__dirname, '../dist/index.html'))
  }

  startRuntime()
}

function createFlyoverWindow(): void {
  if (flyoverWindow && !flyoverWindow.isDestroyed()) return
  const window = new BrowserWindow({
    width: 420,
    height: 148,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, 'flyover-preload.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  flyoverWindow = window
  window.setAlwaysOnTop(true, process.platform === 'darwin' ? 'status' : 'floating')
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.on('closed', () => {
    if (flyoverWindow === window) flyoverWindow = null
  })
  flyoverService?.attachWindow(window)
  if (RENDERER_DEV_URL) {
    void window.loadURL(`${RENDERER_DEV_URL}?flyover=1`)
  } else {
    void window.loadFile(join(__dirname, '../dist/index.html'), { query: { flyover: '1' } })
  }
}

function createTray(): void {
  if (tray) return
  const icon = resolveTrayIcon() ?? resolveAppIcon()
  if (!icon) return
  if (process.platform === 'darwin') icon.setTemplateImage(true)
  tray = new Tray(icon)
  tray.setToolTip('Micky')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Micky', click: () => showMainWindow() },
      { label: 'Settings', click: () => showMainWindow(true) },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          isQuitting = true
          app.quit()
        }
      }
    ])
  )
  tray.on('click', () => showMainWindow())
}

function showAssistantFlyover(silent: boolean): void {
  assistantFlyoverActive = true
  assistantShortcutSilent = silent
  flyoverService?.show({
    mode: 'assistant',
    phase: 'listening',
    title: 'میکی',
    text: 'گوش می‌دم…',
    hint: 'هر وقت آماده‌ای شروع کن',
    interactive: false
  })
}

function stopAssistantFlyoverSession(): void {
  if (!assistantFlyoverActive) return
  assistantFlyoverActive = false
  assistantShortcutSilent = false
  flyoverService?.hide()
  conversation?.onWakeResume()
  agentService?.abort()
  ttsService?.stop()
  speechService?.cancelSession()
  wakeWordService?.endExternalSession()
}

function handleAssistantShortcut(): void {
  if (assistantFlyoverActive) {
    stopAssistantFlyoverSession()
    return
  }
  dictationController?.cancel()
  ttsService?.stop()
  conversation?.onWakeActivated()
  showAssistantFlyover(true)
  wakeWordService?.beginExternalSession()
  void speechService?.startSession({ preroll: false, mode: 'conversation' })
}

function handleAgentStatus(status: AgentStatus): void {
  if (!assistantFlyoverActive) return
  const turn = status.turn
  if (!turn) return
  if (turn.phase === 'confirm') {
    flyoverService?.show({
      mode: 'assistant',
      phase: 'confirm',
      title: 'تأیید لازم است',
      text: turn.confirmText ?? 'این کار رو انجام بدم؟',
      hint: 'بگو آره یا نه، یا یکی از گزینه‌ها را بزن',
      detail: turn.confirmDetail,
      interactive: true,
      canApprove: true
    })
    return
  }
  const reply = turn.replyText.trim()
  flyoverService?.update({
    mode: 'assistant',
    phase:
      turn.phase === 'tool'
        ? 'tool'
        : turn.phase === 'speaking' || (turn.phase === 'idle' && Boolean(reply))
          ? 'reply'
          : turn.phase === 'error'
            ? 'error'
            : 'thinking',
    title: 'میکی',
    text: reply.slice(0, 700) || turn.error || agentStatusLabel(turn.phase, turn.toolName),
    hint: null,
    detail: null,
    interactive: false,
    canApprove: false,
    canRespondToDisclosure: false,
    canFinish: false
  })
}

function handleConversationStatus(status: ConversationStatus): void {
  if (!assistantFlyoverActive) return
  if (status.mode === 'followup') {
    if (status.followupHeard) return
    const current = flyoverService?.getSnapshot()
    if (current?.phase === 'reply' && current.text.trim()) {
      flyoverService?.update({
        phase: 'reply',
        title: 'میکی',
        hint: 'ادامه بده…',
        interactive: false,
        canApprove: false
      })
    } else {
      flyoverService?.update({
        phase: 'listening',
        title: 'میکی',
        text: 'ادامه بده…',
        hint: null,
        interactive: false,
        canApprove: false
      })
    }
    return
  }
  if (status.mode === 'idle' && !speechService?.isSessionActive()) {
    assistantFlyoverActive = false
    assistantShortcutSilent = false
    flyoverService?.hide()
  }
}

function startRuntime(): void {
  const wakeWordResourcesRoot = app.isPackaged
    ? join(process.resourcesPath, 'wakeword')
    : join(app.getAppPath(), 'assets', 'wakeword')

  wakeWordService?.dispose()
  speechService?.dispose()
  conversation?.dispose()
  ttsService?.stop()

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
    onSessionEnd: (mode: SpeechSessionMode) => {
      if (mode === 'dictation') dictationController?.onSessionEnd()
      else conversation?.onSpeechSessionEnd()
    },
    onPartialTranscript: (text, mode) => {
      if (mode === 'dictation') dictationController?.onPartial(text)
      else {
        if (assistantFlyoverActive && conversation?.getStatus().mode !== 'confirm' && text.trim()) {
          flyoverService?.update({
            phase: 'listening',
            title: 'صدای تو',
            text: text.trim().slice(0, 700),
            hint: 'دارم می‌شنوم…',
            detail: null,
            interactive: false,
            canApprove: false
          })
        }
        conversation?.onPartialTranscript(text)
      }
    },
    onFinalTranscript: (text, mode) => {
      if (mode === 'dictation') void dictationController?.onFinal(text)
      else {
        if (assistantFlyoverActive && conversation?.getStatus().mode !== 'confirm' && text.trim()) {
          flyoverService?.update({
            phase: 'thinking',
            title: 'میکی',
            text: 'دارم فکر می‌کنم…',
            hint: null
          })
        }
        conversation?.onFinalTranscript(text)
      }
    }
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
    onActivated: (activation) => {
      conversation?.onWakeActivated()
      if (shouldShowWakeFlyover(activation, mainWindow?.isFocused() === true)) {
        showAssistantFlyover(false)
      }
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
  if (process.platform === 'darwin') {
    const icon = resolveAppIcon()
    if (icon) app.dock?.setIcon(icon)
  }
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
  ttsService = new TtsService({
    settings: settingsStore,
    secrets: secretStore,
    getWindow: () => mainWindow
  })
  void ttsService.refresh()
  flyoverService = new FlyoverService(positionFlyover)
  visionService = new VisionService({
    settings: settingsStore,
    llm: llmService,
    flyover: flyoverService
  })
  agentService = new AgentService({
    settings: settingsStore,
    llm: llmService,
    soul: soulStore,
    getWindow: () => mainWindow,
    onApprovalNeeded: () => conversation?.onApprovalNeeded(),
    lookAtScreen: (question, abortSignal) => visionService!.inspect(question, abortSignal),
    onStatusChange: handleAgentStatus
  })
  conversation = new ConversationController({
    settings: settingsStore,
    llm: llmService,
    getAgent: () => agentService,
    getSpeech: () => speechService,
    getTts: () => ttsService,
    getWakeWord: () => wakeWordService,
    getWindow: () => mainWindow,
    onStatusChange: handleConversationStatus,
    shouldUseVoice: () => !assistantShortcutSilent
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
  createFlyoverWindow()
  createTray()
  dictationController = new DictationController({
    settings: settingsStore,
    llm: llmService,
    getSpeech: () => speechService,
    getWakeWord: () => wakeWordService,
    flyover: flyoverService,
    interruptAssistant: () => {
      assistantFlyoverActive = false
      assistantShortcutSilent = false
      conversation?.onWakeResume()
      agentService?.abort()
      ttsService?.stop()
    }
  })
  shortcutService = new ShortcutService({
    settings: settingsStore,
    registry: globalShortcut,
    onAssistant: handleAssistantShortcut,
    onDictation: () => void dictationController?.toggle(),
    onError: (error) => {
      shortcutError = error
      emitSettingsSnapshot()
    }
  })
  shortcutService.registerAll()

  app.on('activate', function () {
    showMainWindow()
  })
})

app.on('window-all-closed', () => {
  // Micky remains available from the tray and global shortcuts.
})

app.on('before-quit', () => {
  isQuitting = true
  shortcutService?.unregisterAll()
  dictationController?.cancel()
  conversation?.dispose()
  agentService?.abort()
  wakeWordService?.dispose()
  speechService?.dispose()
  ttsService?.dispose()
  flyoverService?.dispose()
  tray?.destroy()
  tray = null
  conversation = null
  agentService = null
  wakeWordService = null
  speechService = null
  ttsService = null
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

function asTtsProviderId(value: unknown): TtsProviderId {
  if (value === 'gemini' || value === 'elevenlabs') return value
  throw new Error('Invalid TTS provider.')
}
