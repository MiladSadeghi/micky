import { generateText } from 'ai'
import type { FlyoverService } from '../flyover/service'
import type { LlmService } from '../llm/service'
import type { SettingsStore } from '../settings/store'
import type { SpeechService } from '../speech/service'
import type { WakeWordService } from '../wake-word/service'
import type { ForegroundTarget, PasteService } from '../system/paste'

type DictationControllerOptions = {
  settings: SettingsStore
  llm: LlmService
  getSpeech: () => SpeechService | null
  getWakeWord: () => WakeWordService | null
  flyover: FlyoverService
  paste: PasteService
  writeClipboard: (text: string) => void
  refine?: (text: string) => Promise<string>
  interruptAssistant: () => void
}

export class DictationController {
  #active = false
  #finishing = false
  #generation = 0
  #target: ForegroundTarget | null = null
  readonly #paste: PasteService

  constructor(private readonly options: DictationControllerOptions) {
    this.#paste = options.paste
  }

  isActive(): boolean {
    return this.#active || this.#finishing
  }

  async toggle(): Promise<void> {
    if (this.#active) {
      this.finish()
      return
    }
    if (this.#finishing) return
    await this.start()
  }

  async start(): Promise<void> {
    const generation = ++this.#generation
    this.options.interruptAssistant()
    this.options.getSpeech()?.cancelSession()
    this.#active = true
    this.#finishing = false
    this.#target = await this.#paste.captureForeground()
    if (!this.#active || generation !== this.#generation) return
    this.options.getWakeWord()?.beginExternalSession()
    this.options.flyover.show({
      mode: 'dictation',
      phase: 'listening',
      title: 'دیکته',
      text: 'دارم گوش می‌دم…',
      hint: this.#willRefine()
        ? 'دوباره میانبر را بزن؛ بعد متن با هوش مصنوعی تمیز می‌شود.'
        : 'برای پایان، میانبر دیکته را دوباره بزن.',
      interactive: false,
      canFinish: false
    })
    await this.options.getSpeech()?.startSession({ preroll: false, mode: 'dictation' })
  }

  finish(): void {
    if (!this.#active) return
    this.#active = false
    this.#finishing = true
    this.options.flyover.update({
      phase: 'cleaning',
      title: 'دیکته',
      text: 'دارم گفتارت رو نهایی می‌کنم…',
      hint: null,
      interactive: false,
      canFinish: false
    })
    this.options.getSpeech()?.finishSession()
  }

  cancel(): void {
    this.#generation += 1
    this.#active = false
    this.#finishing = false
    this.options.getSpeech()?.cancelSession()
    this.options.getWakeWord()?.endExternalSession()
    this.options.flyover.hide()
  }

  onPartial(text: string): void {
    if (!this.#active) return
    this.options.flyover.update({ text: text.trim() || 'دارم گوش می‌دم…' })
  }

  async onFinal(rawText: string): Promise<void> {
    if (!this.#active && !this.#finishing) return
    const generation = this.#generation
    this.#active = false
    this.#finishing = true
    const raw = rawText.trim()
    if (!raw) {
      this.#complete(generation, 'چیزی نشنیدم.', 'error')
      return
    }

    const willRefine = this.#willRefine()
    this.options.flyover.update({
      phase: 'cleaning',
      title: willRefine ? 'اصلاح با هوش مصنوعی' : 'دیکته',
      text: willRefine ? 'دارم متن رو تمیز می‌کنم…' : 'دارم متن رو آماده می‌کنم…',
      hint: null,
      interactive: false,
      canFinish: false
    })
    const finalText = willRefine ? await this.#cleanup(raw) : raw
    if (generation !== this.#generation) return
    this.options.writeClipboard(finalText)
    const settings = this.options.settings.get()
    const pasted =
      settings.dictationAutoPaste && this.#target ? await this.#paste.paste(this.#target) : false
    if (generation !== this.#generation) return
    this.#complete(generation, pasted ? 'نوشته شد.' : 'متن کپی شد.', 'done')
  }

  onSessionEnd(): void {
    if (!this.#active) return
    if (this.options.getSpeech()?.getStatus().phase === 'error') {
      this.#active = false
      this.#finishing = true
      this.#complete(this.#generation, 'تشخیص گفتار در دسترس نیست.', 'error')
      return
    }
    this.finish()
  }

  async #cleanup(text: string): Promise<string> {
    try {
      if (this.options.refine) return (await this.options.refine(text)).trim() || text
      const result = await generateText({
        model: this.options.llm.getModel(),
        system:
          'You clean speech-to-text dictation. Return only the cleaned text. Preserve the exact wording and language. You may only fix punctuation, spacing, capitalization, and obvious ASR mistakes. Never summarize, translate, answer, or add content.',
        prompt: text,
        temperature: 0,
        maxOutputTokens: 2_000,
        abortSignal: AbortSignal.timeout(15_000)
      })
      return result.text.trim() || text
    } catch {
      return text
    }
  }

  #willRefine(): boolean {
    return this.options.settings.get().dictationAiCleanup && this.options.llm.isConfigured()
  }

  #complete(generation: number, text: string, phase: 'done' | 'error'): void {
    if (generation !== this.#generation) return
    this.#finishing = false
    this.#target = null
    this.options.getWakeWord()?.endExternalSession()
    this.options.flyover.update({ phase, text, interactive: false, canFinish: false })
    setTimeout(() => {
      if (generation === this.#generation && !this.isActive()) this.options.flyover.hide()
    }, 1_800)
  }
}
