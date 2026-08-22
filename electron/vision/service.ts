import { desktopCapturer, screen, shell, systemPreferences, type NativeImage } from 'electron'
import { generateText, type ModelMessage } from 'ai'
import type { ScreenAccessStatus } from '@/lib/settings'
import type { FlyoverService } from '../flyover/service'
import type { LlmService } from '../llm/service'
import type { SettingsStore } from '../settings/store'

type VisionServiceOptions = {
  settings: SettingsStore
  llm: LlmService
  flyover: FlyoverService
}

export class VisionService {
  constructor(private readonly options: VisionServiceOptions) {}

  getAccessStatus(): ScreenAccessStatus {
    if (process.platform !== 'darwin') return 'not-required'
    return systemPreferences.getMediaAccessStatus('screen')
  }

  async openAccessSettings(): Promise<void> {
    if (process.platform !== 'darwin') return
    await shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
    )
  }

  async inspect(question: string, abortSignal?: AbortSignal): Promise<string> {
    if (abortSignal?.aborted) return 'دیدن صفحه متوقف شد.'
    const keepFlyover = this.options.flyover.getSnapshot().visible
    const finish = (message: string): string => {
      if (!keepFlyover) {
        this.options.flyover.hide()
        return message
      }
      if (!this.options.flyover.getSnapshot().visible) {
        this.options.flyover.reveal({
          mode: 'assistant',
          phase: 'thinking',
          title: 'میکی',
          text: 'دارم فکر می‌کنم…',
          interactive: false
        })
      }
      return message
    }

    if (!this.options.settings.get().screenAccessEnabled) {
      return finish('دیدن صفحه از تنظیمات «ابزارها و دسترسی‌ها» خاموش است.')
    }

    if (!this.options.settings.get().screenDisclosureAccepted) {
      const accepted = await this.options.flyover.requestDisclosure(
        'میکی یک تصویر از نمایشگر فعال را برای تحلیل به مدل تصویری OpenRouter می‌فرستد. تصویر ذخیره نمی‌شود.'
      )
      if (!accepted) return finish('کاربر اجازه دیدن صفحه را نداد.')
      await this.options.settings.update({ screenDisclosureAccepted: true })
    }

    if (abortSignal?.aborted) return finish('دیدن صفحه متوقف شد.')

    if (process.platform === 'darwin') {
      const status = this.getAccessStatus()
      if (status === 'denied' || status === 'restricted') {
        return finish(
          'اجازه ضبط صفحه داده نشده. از تنظیمات حریم خصوصی macOS دسترسی Screen Recording را برای میکی روشن کن.'
        )
      }
    }

    const modelId = this.options.llm.getVisionModelId()
    if (!modelId) return finish('مدل تصویری پشتیبانی‌شده‌ای تنظیم نشده.')

    this.options.flyover.reveal({
      mode: 'screen',
      phase: 'capturing',
      title: 'دیدن صفحه',
      text: 'دارم از نمایشگر فعال تصویر می‌گیرم…',
      hint: null,
      previewImage: null,
      interactive: false
    })
    const hideForCapture = !canExcludeOverlayFromCapture()
    if (hideForCapture) {
      this.options.flyover.hide()
      await delay(140)
    }
    if (abortSignal?.aborted) return finish('دیدن صفحه متوقف شد.')
    try {
      const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: fitSize(display.size.width, display.size.height, 1_600)
      })
      const source =
        sources.find((candidate) => candidate.display_id === String(display.id)) ??
        (sources.length === 1 ? sources[0] : undefined)
      if (!source || source.thumbnail.isEmpty()) {
        return finish('گرفتن تصویر نمایشگر فعال ناموفق بود.')
      }
      const jpeg = source.thumbnail.toJPEG(78)
      if (abortSignal?.aborted) return finish('دیدن صفحه متوقف شد.')
      this.options.flyover.reveal({
        mode: 'screen',
        phase: 'looking',
        title: 'دیدن صفحه',
        text: 'دارم نگاه می‌کنم…',
        previewImage: toPreviewDataUrl(source.thumbnail),
        hint: null,
        interactive: false
      })
      const message: ModelMessage = {
        role: 'user',
        content: [
          { type: 'text', text: question || 'صفحه را دقیق توصیف کن.' },
          {
            type: 'file',
            data: { type: 'data', data: new Uint8Array(jpeg) },
            mediaType: 'image/jpeg'
          }
        ]
      }
      const result = await generateText({
        model: this.options.llm.getProvider().getModel(modelId),
        system:
          'Analyze only the visible screenshot. Return concise factual observations in Persian that another assistant can use to answer the user. Never claim to see anything outside the image.',
        messages: [message],
        maxOutputTokens: 1_000,
        abortSignal: abortSignal
          ? AbortSignal.any([abortSignal, AbortSignal.timeout(30_000)])
          : AbortSignal.timeout(30_000)
      })
      return finish(result.text.trim() || 'چیزی قابل توضیح در تصویر پیدا نشد.')
    } catch (error) {
      if (abortSignal?.aborted) return finish('دیدن صفحه متوقف شد.')
      const message = error instanceof Error ? error.message : ''
      return finish(
        message.includes('permission')
          ? 'اجازه دسترسی به صفحه داده نشده.'
          : 'دیدن صفحه این بار ناموفق بود.'
      )
    }
  }
}

function canExcludeOverlayFromCapture(): boolean {
  return process.platform === 'darwin' || process.platform === 'win32'
}

function toPreviewDataUrl(image: NativeImage): string {
  const width = Math.min(640, image.getSize().width)
  const jpeg = image.resize({ width, quality: 'good' }).toJPEG(58)
  return `data:image/jpeg;base64,${Buffer.from(jpeg).toString('base64')}`
}

function fitSize(width: number, height: number, max: number): Electron.Size {
  const scale = Math.min(1, max / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
