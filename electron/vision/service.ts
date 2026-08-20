import { desktopCapturer, screen, systemPreferences } from 'electron'
import { generateText, type ModelMessage } from 'ai'
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

  async inspect(question: string, abortSignal?: AbortSignal): Promise<string> {
    if (abortSignal?.aborted) return 'دیدن صفحه متوقف شد.'
    if (!this.options.settings.get().screenDisclosureAccepted) {
      const accepted = await this.options.flyover.requestDisclosure(
        'میکی یک تصویر از نمایشگر فعال را برای تحلیل به مدل تصویری OpenRouter می‌فرستد. تصویر ذخیره نمی‌شود.'
      )
      if (!accepted) {
        this.options.flyover.hide()
        return 'کاربر اجازه دیدن صفحه را نداد.'
      }
      await this.options.settings.update({ screenDisclosureAccepted: true })
    }

    if (abortSignal?.aborted) return 'دیدن صفحه متوقف شد.'

    if (process.platform === 'darwin') {
      const status = systemPreferences.getMediaAccessStatus('screen')
      if (status === 'denied' || status === 'restricted') {
        this.options.flyover.hide()
        return 'اجازه ضبط صفحه داده نشده. از تنظیمات حریم خصوصی macOS دسترسی Screen Recording را برای میکی روشن کن.'
      }
    }

    const modelId = this.options.llm.getVisionModelId()
    if (!modelId) {
      this.options.flyover.hide()
      return 'مدل تصویری پشتیبانی‌شده‌ای تنظیم نشده.'
    }

    this.options.flyover.show({
      mode: 'screen',
      phase: 'capturing',
      title: 'دیدن صفحه',
      text: 'دارم از نمایشگر فعال تصویر می‌گیرم…',
      interactive: false
    })
    await delay(220)
    if (abortSignal?.aborted) {
      this.options.flyover.hide()
      return 'دیدن صفحه متوقف شد.'
    }
    this.options.flyover.hide()
    await delay(140)
    if (abortSignal?.aborted) return 'دیدن صفحه متوقف شد.'
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
        this.options.flyover.hide()
        return 'گرفتن تصویر نمایشگر فعال ناموفق بود.'
      }
      const jpeg = source.thumbnail.toJPEG(78)
      if (abortSignal?.aborted) return 'دیدن صفحه متوقف شد.'
      this.options.flyover.show({
        mode: 'screen',
        phase: 'looking',
        title: 'دیدن صفحه',
        text: 'دارم نگاه می‌کنم…',
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
      this.options.flyover.hide()
      return result.text.trim() || 'چیزی قابل توضیح در تصویر پیدا نشد.'
    } catch (error) {
      this.options.flyover.hide()
      if (abortSignal?.aborted) return 'دیدن صفحه متوقف شد.'
      const message = error instanceof Error ? error.message : ''
      return message.includes('permission')
        ? 'اجازه دسترسی به صفحه داده نشده.'
        : 'دیدن صفحه این بار ناموفق بود.'
    }
  }
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
