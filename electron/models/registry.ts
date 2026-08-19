import { access, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { BrowserWindow } from 'electron'
import { MODELS_STATUS_CHANNEL, type AsrModelView, type ModelsSnapshot } from '@/lib/asr'
import {
  ASR_MODELS,
  getAsrModel,
  getAsrModelBytes,
  type AsrModelDefinition
} from '@/lib/asr-models'
import type { SettingsStore } from '../settings/store'
import { ModelDownloader } from './downloader'

type ModelRuntimeState = {
  bytesDownloaded: number
  error: string | null
}

type ModelRegistryOptions = {
  modelsRoot: string
  settings: SettingsStore
  getWindow: () => BrowserWindow | null
  isSessionActive: () => boolean
  onActiveModelChange: (modelId: string | null) => void
}

export class ModelRegistry {
  #downloader: ModelDownloader
  #runtime = new Map<string, ModelRuntimeState>()
  #installed = new Set<string>()

  constructor(private readonly options: ModelRegistryOptions) {
    this.#downloader = new ModelDownloader(options.modelsRoot, (progress) => {
      this.#runtime.set(progress.modelId, {
        bytesDownloaded: progress.bytesDownloaded,
        error: null
      })
      this.#emit()
    })
  }

  async initialize(): Promise<void> {
    for (const model of ASR_MODELS) {
      if (await this.#isInstalled(model)) this.#installed.add(model.id)
    }
    this.#emit()
  }

  getSnapshot(): ModelsSnapshot {
    return {
      activeModelId: this.options.settings.get().activeModelId,
      models: ASR_MODELS.map((model) => this.#toView(model))
    }
  }

  getModelDir(modelId: string): string {
    return join(this.options.modelsRoot, modelId)
  }

  isInstalled(modelId: string): boolean {
    return this.#installed.has(modelId)
  }

  async download(modelId: string): Promise<ModelsSnapshot> {
    const model = requireModel(modelId)
    this.#runtime.set(modelId, { bytesDownloaded: 0, error: null })
    this.#emit()
    try {
      await this.#downloader.download(model)
      if (await this.#isInstalled(model)) {
        this.#installed.add(modelId)
        this.#runtime.delete(modelId)
        const settings = this.options.settings.get()
        if (settings.activeModelId === modelId || !this.#installed.has(settings.activeModelId)) {
          await this.options.settings.update({ activeModelId: modelId })
          this.options.onActiveModelChange(modelId)
        }
      }
    } catch (error) {
      if (isAbortError(error)) {
        this.#runtime.delete(modelId)
      } else {
        this.#runtime.set(modelId, {
          bytesDownloaded: this.#runtime.get(modelId)?.bytesDownloaded ?? 0,
          error: error instanceof Error ? error.message : 'دانلود ناموفق بود.'
        })
        this.#emit()
        throw error
      }
    }
    this.#emit()
    return this.getSnapshot()
  }

  cancel(modelId: string): ModelsSnapshot {
    this.#downloader.cancel(modelId)
    return this.getSnapshot()
  }

  async remove(modelId: string): Promise<ModelsSnapshot> {
    requireModel(modelId)
    if (this.options.isSessionActive() && this.options.settings.get().activeModelId === modelId) {
      throw new Error('تا وقتی در حال شنیدن هستی نمی‌شود مدل فعال را حذف کرد.')
    }
    if (this.#downloader.isDownloading(modelId)) this.#downloader.cancel(modelId)
    await rm(this.getModelDir(modelId), { recursive: true, force: true })
    this.#installed.delete(modelId)
    this.#runtime.delete(modelId)
    const settings = this.options.settings.get()
    if (settings.activeModelId === modelId) {
      const fallback = ASR_MODELS.find((model) => this.#installed.has(model.id))?.id ?? modelId
      await this.options.settings.update({ activeModelId: fallback })
      this.options.onActiveModelChange(this.#installed.has(fallback) ? fallback : null)
    }
    this.#emit()
    return this.getSnapshot()
  }

  async setActive(modelId: string): Promise<ModelsSnapshot> {
    requireModel(modelId)
    if (!this.#installed.has(modelId)) {
      throw new Error('اول مدل را دانلود کن.')
    }
    await this.options.settings.update({ activeModelId: modelId })
    this.options.onActiveModelChange(modelId)
    this.#emit()
    return this.getSnapshot()
  }

  #toView(model: AsrModelDefinition): AsrModelView {
    const runtime = this.#runtime.get(model.id)
    const downloading = this.#downloader.isDownloading(model.id)
    const installed = this.#installed.has(model.id)
    return {
      id: model.id,
      label: model.label,
      description: model.description,
      params: model.params,
      bytes: getAsrModelBytes(model),
      isDefault: model.isDefault,
      cardUrl: model.cardUrl,
      state: downloading
        ? 'downloading'
        : runtime?.error
          ? 'error'
          : installed
            ? 'installed'
            : 'missing',
      bytesDownloaded: downloading
        ? (runtime?.bytesDownloaded ?? 0)
        : installed
          ? getAsrModelBytes(model)
          : (runtime?.bytesDownloaded ?? 0),
      error: runtime?.error ?? null
    }
  }

  async #isInstalled(model: AsrModelDefinition): Promise<boolean> {
    try {
      for (const file of model.files) {
        await access(join(this.getModelDir(model.id), file.name))
      }
      return true
    } catch {
      return false
    }
  }

  #emit(): void {
    const window = this.options.getWindow()
    if (window && !window.isDestroyed()) {
      window.webContents.send(MODELS_STATUS_CHANNEL, this.getSnapshot())
    }
  }
}

function requireModel(modelId: string): AsrModelDefinition {
  const model = getAsrModel(modelId)
  if (!model) throw new Error('مدل ناشناخته است.')
  return model
}

function isAbortError(error: unknown): boolean {
  if (error instanceof Error && error.name === 'AbortError') return true
  return error instanceof Error && error.message.includes('لغو')
}
