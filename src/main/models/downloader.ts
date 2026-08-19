import { createHash, type Hash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { finished } from 'node:stream/promises'
import { ASR_PROGRESS_BROADCAST_INTERVAL_MS } from '../../shared/asr'
import {
  huggingfaceFileUrl,
  type AsrModelDefinition,
  type AsrModelFile
} from '../../shared/asr-models'

export type DownloadProgress = {
  modelId: string
  bytesDownloaded: number
  bytesTotal: number
}

type DownloadJob = {
  controller: AbortController
  promise: Promise<void>
}

const USER_AGENT = 'micky/1.0'

export class ModelDownloader {
  #jobs = new Map<string, DownloadJob>()
  #lastProgressAt = 0

  constructor(
    private readonly modelsRoot: string,
    private readonly onProgress: (progress: DownloadProgress) => void
  ) {}

  isDownloading(modelId: string): boolean {
    return this.#jobs.has(modelId)
  }

  async download(model: AsrModelDefinition): Promise<void> {
    const existing = this.#jobs.get(model.id)
    if (existing) return existing.promise

    const controller = new AbortController()
    const promise = this.#run(model, controller.signal).finally(() => {
      this.#jobs.delete(model.id)
    })
    this.#jobs.set(model.id, { controller, promise })
    return promise
  }

  cancel(modelId: string): boolean {
    const job = this.#jobs.get(modelId)
    if (!job) return false
    job.controller.abort()
    return true
  }

  async #run(model: AsrModelDefinition, signal: AbortSignal): Promise<void> {
    const destination = join(this.modelsRoot, model.id)
    await mkdir(destination, { recursive: true })

    let completed = 0
    const total = model.files.reduce((sum, file) => sum + file.bytes, 0)
    this.#emit({ modelId: model.id, bytesDownloaded: 0, bytesTotal: total }, true)

    for (const file of model.files) {
      if (signal.aborted) throw new Error('دانلود لغو شد.')
      await this.#downloadFile(model, file, destination, signal, (fileBytes) => {
        this.#emit({
          modelId: model.id,
          bytesDownloaded: completed + fileBytes,
          bytesTotal: total
        })
      })
      completed += file.bytes
      this.#emit({ modelId: model.id, bytesDownloaded: completed, bytesTotal: total }, true)
    }
  }

  async #downloadFile(
    model: AsrModelDefinition,
    file: AsrModelFile,
    destination: string,
    signal: AbortSignal,
    onBytes: (bytes: number) => void
  ): Promise<void> {
    const finalPath = join(destination, file.name)
    const partPath = `${finalPath}.part`
    let existing = await fileSize(partPath)
    let hash = createHash('sha256')

    if (existing > 0) await hashFile(partPath, hash)

    const response = await fetch(huggingfaceFileUrl(model.repo, file.name), {
      headers: {
        'User-Agent': USER_AGENT,
        ...(existing > 0 ? { Range: `bytes=${existing}-` } : {})
      },
      redirect: 'follow',
      signal
    })

    if (!response.ok && response.status !== 206) {
      throw new Error(`دانلود ${file.name} ناموفق بود (${response.status}).`)
    }

    const resumed = existing > 0 && response.status === 206
    if (!resumed) {
      if (existing > 0) await rm(partPath, { force: true })
      existing = 0
      hash = createHash('sha256')
    }

    const writer = createWriteStream(partPath, { flags: resumed ? 'a' : 'w' })
    if (!response.body) throw new Error(`پاسخ خالی برای ${file.name}.`)

    let written = existing
    const reader = response.body.getReader()

    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        hash.update(value)
        written += value.byteLength
        if (!writer.write(Buffer.from(value))) {
          await new Promise<void>((resolve) => writer.once('drain', resolve))
        }
        onBytes(written)
      }
      writer.end()
      await finished(writer)
    } catch (error) {
      writer.destroy()
      throw error
    }

    const sha256 = hash.digest('hex')
    if (sha256 !== file.sha256) {
      await rm(partPath, { force: true })
      throw new Error(`هش فایل ${file.name} معتبر نیست.`)
    }

    await rename(partPath, finalPath)
  }

  #emit(progress: DownloadProgress, force = false): void {
    const now = Date.now()
    if (!force && now - this.#lastProgressAt < ASR_PROGRESS_BROADCAST_INTERVAL_MS) return
    this.#lastProgressAt = now
    this.onProgress(progress)
  }
}

async function fileSize(path: string): Promise<number> {
  try {
    return (await stat(path)).size
  } catch {
    return 0
  }
}

async function hashFile(path: string, hash: Hash): Promise<void> {
  const stream = createReadStream(path)
  for await (const chunk of stream) {
    hash.update(chunk)
  }
}
