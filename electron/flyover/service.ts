import type { BrowserWindow } from 'electron'
import {
  FLYOVER_SNAPSHOT_CHANNEL,
  INITIAL_FLYOVER_SNAPSHOT,
  type FlyoverSnapshot
} from '@/lib/flyover'

export class FlyoverService {
  #window: BrowserWindow | null = null
  #snapshot: FlyoverSnapshot = { ...INITIAL_FLYOVER_SNAPSHOT }
  #disclosureResolver: ((accepted: boolean) => void) | null = null

  constructor(private readonly positionWindow: (window: BrowserWindow) => void) {}

  attachWindow(window: BrowserWindow): void {
    this.#window = window
    window.webContents.once('did-finish-load', () => this.#emit())
  }

  getSnapshot(): FlyoverSnapshot {
    return { ...this.#snapshot }
  }

  show(update: Partial<FlyoverSnapshot>): FlyoverSnapshot {
    this.#snapshot = {
      ...INITIAL_FLYOVER_SNAPSHOT,
      ...update,
      visible: true,
      phase: update.phase ?? 'listening'
    }
    this.#present()
    return this.getSnapshot()
  }

  update(update: Partial<FlyoverSnapshot>): FlyoverSnapshot {
    this.#snapshot = { ...this.#snapshot, ...update }
    if (this.#snapshot.visible) this.#present()
    else this.#emit()
    return this.getSnapshot()
  }

  hide(): void {
    this.resolveDisclosure(false)
    this.#snapshot = {
      ...this.#snapshot,
      visible: false,
      phase: 'hidden',
      interactive: false,
      canFinish: false,
      canApprove: false,
      canRespondToDisclosure: false
    }
    this.#emit()
    const window = this.#window
    if (window && !window.isDestroyed()) window.hide()
  }

  requestDisclosure(text: string): Promise<boolean> {
    this.resolveDisclosure(false)
    this.show({
      mode: 'screen',
      phase: 'disclosure',
      title: 'اجازه دیدن صفحه',
      text,
      detail: null,
      interactive: true,
      canRespondToDisclosure: true
    })
    return new Promise((resolve) => {
      this.#disclosureResolver = resolve
    })
  }

  resolveDisclosure(accepted: boolean): void {
    const resolver = this.#disclosureResolver
    this.#disclosureResolver = null
    resolver?.(accepted)
  }

  dispose(): void {
    this.resolveDisclosure(false)
    this.#window = null
  }

  #present(): void {
    const window = this.#window
    if (!window || window.isDestroyed()) return
    this.positionWindow(window)
    window.setFocusable(this.#snapshot.interactive)
    this.#emit()
    if (this.#snapshot.interactive) window.show()
    else window.showInactive()
  }

  #emit(): void {
    const window = this.#window
    if (window && !window.isDestroyed()) {
      window.webContents.send(FLYOVER_SNAPSHOT_CHANNEL, this.#snapshot)
    }
  }
}
