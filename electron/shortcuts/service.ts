import type { SettingsStore } from '../settings/store'

export type ShortcutKind = 'assistant' | 'newChat' | 'dictation' | 'wakeWord'

type ShortcutServiceOptions = {
  settings: SettingsStore
  registry: ShortcutRegistry
  onAssistant: () => void
  onNewChat: () => void
  onDictation: () => void
  onToggleWakeWord: () => void
  onError?: (error: string | null) => void
}

export type ShortcutRegistry = {
  register: (accelerator: string, callback: () => void) => boolean
  unregister: (accelerator: string) => void
  unregisterAll: () => void
  isRegistered: (accelerator: string) => boolean
}

export class ShortcutService {
  #registered = new Map<ShortcutKind, string>()

  constructor(private readonly options: ShortcutServiceOptions) {}

  registerAll(): void {
    const settings = this.options.settings.get()
    this.#registerInitial('assistant', settings.assistantShortcut)
    this.#registerInitial('newChat', settings.newChatShortcut)
    this.#registerInitial('dictation', settings.dictationShortcut)
    this.#registerInitial('wakeWord', settings.wakeWordShortcut)
  }

  async replace(kind: ShortcutKind, accelerator: string): Promise<boolean> {
    const next = accelerator.trim()
    const previous = this.#registered.get(kind)
    if (!next || next === previous) return Boolean(previous)
    const conflictsWithMicky = [...this.#registered.entries()].some(
      ([registeredKind, registered]) => registeredKind !== kind && registered === next
    )
    if (conflictsWithMicky || this.options.registry.isRegistered(next)) {
      this.options.onError?.('این میانبر را برنامه دیگری گرفته است؛ میانبر قبلی نگه داشته شد.')
      return false
    }

    if (previous) this.options.registry.unregister(previous)
    if (!this.options.registry.register(next, this.#callback(kind))) {
      if (previous) this.options.registry.register(previous, this.#callback(kind))
      this.options.onError?.('ثبت میانبر ممکن نشد؛ میانبر قبلی نگه داشته شد.')
      return false
    }

    this.#registered.set(kind, next)
    try {
      await this.options.settings.update(
        kind === 'assistant'
          ? { assistantShortcut: next }
          : kind === 'newChat'
            ? { newChatShortcut: next }
            : kind === 'dictation'
              ? { dictationShortcut: next }
              : { wakeWordShortcut: next }
      )
    } catch (error) {
      this.options.registry.unregister(next)
      if (previous) {
        this.options.registry.register(previous, this.#callback(kind))
        this.#registered.set(kind, previous)
      } else {
        this.#registered.delete(kind)
      }
      this.options.onError?.('ذخیره میانبر ممکن نشد؛ میانبر قبلی برگردانده شد.')
      throw error
    }
    this.options.onError?.(null)
    return true
  }

  unregisterAll(): void {
    this.options.registry.unregisterAll()
    this.#registered.clear()
  }

  #registerInitial(kind: ShortcutKind, accelerator: string): void {
    if (this.#registered.has(kind)) return
    const success = this.options.registry.register(accelerator, this.#callback(kind))
    if (success) this.#registered.set(kind, accelerator)
    else
      this.options.onError?.(
        `میانبر ${kind === 'assistant' ? 'دستیار' : kind === 'newChat' ? 'گفتگوی تازه' : kind === 'dictation' ? 'دیکته' : 'شنیدن همیشگی'} در دسترس نیست.`
      )
  }

  #callback(kind: ShortcutKind): () => void {
    if (kind === 'assistant') return this.options.onAssistant
    if (kind === 'newChat') return this.options.onNewChat
    if (kind === 'dictation') return this.options.onDictation
    return this.options.onToggleWakeWord
  }
}
