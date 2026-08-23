import assert from 'node:assert/strict'
import test from 'node:test'
import type { BrowserWindow } from 'electron'
import { FlyoverService } from './service'

function fakeWindow(): BrowserWindow & {
  showCount: number
  showInactiveCount: number
  hideCount: number
  focusCount: number
} {
  let visible = false
  let focusable = false
  const window = {
    showCount: 0,
    showInactiveCount: 0,
    hideCount: 0,
    focusCount: 0,
    isDestroyed: () => false,
    isVisible: () => visible,
    isFocusable: () => focusable,
    setFocusable: (value: boolean) => {
      focusable = value
    },
    show: () => {
      visible = true
      window.showCount += 1
    },
    showInactive: () => {
      visible = true
      window.showInactiveCount += 1
    },
    hide: () => {
      visible = false
      window.hideCount += 1
    },
    focus: () => {
      window.focusCount += 1
    },
    webContents: {
      once: () => undefined,
      send: () => undefined
    }
  }
  return window as unknown as BrowserWindow & {
    showCount: number
    showInactiveCount: number
    hideCount: number
    focusCount: number
  }
}

test('shows compact state and clears interactive actions when hidden', () => {
  const service = new FlyoverService(() => undefined)
  service.attachWindow(fakeWindow())
  service.show({
    mode: 'dictation',
    phase: 'listening',
    title: 'دیکته',
    text: 'سلام',
    interactive: true,
    canFinish: true,
    canOpenModels: true
  })
  assert.equal(service.getSnapshot().visible, true)
  assert.equal(service.getSnapshot().canFinish, true)
  service.hide()
  assert.deepEqual(
    {
      visible: service.getSnapshot().visible,
      phase: service.getSnapshot().phase,
      interactive: service.getSnapshot().interactive,
      canFinish: service.getSnapshot().canFinish,
      canOpenModels: service.getSnapshot().canOpenModels
    },
    {
      visible: false,
      phase: 'hidden',
      interactive: false,
      canFinish: false,
      canOpenModels: false
    }
  )
})

test('resolves the one-time disclosure response', async () => {
  const service = new FlyoverService(() => undefined)
  service.attachWindow(fakeWindow())
  const response = service.requestDisclosure('افشا')
  assert.equal(service.getSnapshot().canRespondToDisclosure, true)
  service.resolveDisclosure(true)
  assert.equal(await response, true)
})

test('reveals an assistant reply after screen capture hides the flyover', () => {
  const service = new FlyoverService(() => undefined)
  service.attachWindow(fakeWindow())
  service.show({
    mode: 'screen',
    phase: 'looking',
    title: 'دیدن صفحه',
    text: 'دارم نگاه می‌کنم…'
  })
  service.hide()

  service.reveal({
    mode: 'assistant',
    phase: 'reply',
    title: 'میکی',
    text: 'جواب نهایی'
  })

  assert.deepEqual(
    {
      visible: service.getSnapshot().visible,
      mode: service.getSnapshot().mode,
      phase: service.getSnapshot().phase,
      text: service.getSnapshot().text
    },
    { visible: true, mode: 'assistant', phase: 'reply', text: 'جواب نهایی' }
  )
})

test('keeps a main-window dismissal hidden until a new flyover session starts', () => {
  const service = new FlyoverService(() => undefined)
  service.attachWindow(fakeWindow())
  service.show({
    mode: 'assistant',
    phase: 'thinking',
    title: 'میکی',
    text: 'دارم فکر می‌کنم…'
  })

  service.dismiss()
  service.reveal({ phase: 'reply', text: 'جواب آماده است.' })
  assert.equal(service.getSnapshot().visible, false)
  assert.equal(service.getSnapshot().text, 'جواب آماده است.')

  service.show({ mode: 'assistant', phase: 'listening', text: 'گوش می‌دم…' })
  assert.equal(service.getSnapshot().visible, true)
})

test('conceals and restores an ongoing task without clearing its state', () => {
  const window = fakeWindow()
  const service = new FlyoverService(() => undefined)
  service.attachWindow(window)
  service.show({
    mode: 'assistant',
    phase: 'tool',
    title: 'میکی',
    text: 'دارم فایل‌ها رو می‌گردم…',
    interactive: true
  })

  service.conceal()
  service.reveal({ phase: 'reply', text: 'نتیجه آماده است.' })
  assert.deepEqual(
    {
      visible: service.getSnapshot().visible,
      phase: service.getSnapshot().phase,
      text: service.getSnapshot().text,
      interactive: service.getSnapshot().interactive
    },
    {
      visible: false,
      phase: 'reply',
      text: 'نتیجه آماده است.',
      interactive: true
    }
  )

  service.redisplay()
  assert.equal(service.getSnapshot().visible, true)
  assert.equal(service.getSnapshot().phase, 'reply')
  assert.equal(window.hideCount, 1)
  assert.equal(window.showCount, 2)
})

test('forces a concealed flyover open when an approval is requested', () => {
  const window = fakeWindow()
  const service = new FlyoverService(() => undefined)
  service.attachWindow(window)
  service.show({
    mode: 'assistant',
    phase: 'tool',
    title: 'میکی',
    text: 'دارم آماده می‌کنم…'
  })
  service.conceal()

  service.show({
    mode: 'assistant',
    phase: 'confirm',
    title: 'تأیید لازم است',
    text: 'این کار رو انجام بدم؟',
    interactive: true,
    canApprove: true
  })

  assert.equal(service.getSnapshot().visible, true)
  assert.equal(service.getSnapshot().phase, 'confirm')
  assert.equal(service.getSnapshot().canApprove, true)
  assert.equal(window.showCount, 1)
})

test('keeps the window shown across in-place updates and preserves a screen preview', () => {
  const window = fakeWindow()
  const service = new FlyoverService(() => undefined)
  service.attachWindow(window)
  service.show({
    mode: 'assistant',
    phase: 'thinking',
    title: 'میکی',
    text: 'دارم فکر می‌کنم…'
  })
  assert.equal(window.showCount, 0)
  assert.equal(window.showInactiveCount, 1)

  service.reveal({
    mode: 'screen',
    phase: 'looking',
    title: 'دیدن صفحه',
    text: 'دارم نگاه می‌کنم…',
    previewImage: 'data:image/jpeg;base64,abc'
  })
  service.update({
    mode: 'assistant',
    phase: 'tool',
    title: 'میکی',
    text: 'دارم صفحه رو نگاه می‌کنم…'
  })

  assert.equal(window.showCount, 0)
  assert.equal(window.showInactiveCount, 1)
  assert.equal(window.hideCount, 0)
  assert.equal(service.getSnapshot().visible, true)
  assert.equal(service.getSnapshot().previewImage, 'data:image/jpeg;base64,abc')
  assert.equal(service.getSnapshot().phase, 'tool')
})

test('clears the screen preview when the assistant reply starts', () => {
  const service = new FlyoverService(() => undefined)
  service.attachWindow(fakeWindow())
  service.show({
    mode: 'screen',
    phase: 'looking',
    previewImage: 'data:image/jpeg;base64,abc'
  })
  service.reveal({
    mode: 'assistant',
    phase: 'reply',
    title: 'میکی',
    text: 'روی صفحه یه مرورگر بازه.',
    previewImage: null
  })
  assert.equal(service.getSnapshot().previewImage, null)
  assert.equal(service.getSnapshot().phase, 'reply')
})

test('clears the screen preview when the flyover hides', () => {
  const service = new FlyoverService(() => undefined)
  service.attachWindow(fakeWindow())
  service.show({
    mode: 'screen',
    phase: 'looking',
    previewImage: 'data:image/jpeg;base64,abc'
  })
  service.hide()
  assert.equal(service.getSnapshot().previewImage, null)
  assert.equal(service.getSnapshot().canCompose, false)
})

test('focuses an interactive shortcut listen instead of showing inactive', () => {
  const window = fakeWindow()
  const service = new FlyoverService(() => undefined)
  service.attachWindow(window)
  service.show({
    mode: 'assistant',
    phase: 'listening',
    title: 'میکی',
    text: 'گوش می‌دم…',
    interactive: true,
    canCompose: true
  })
  assert.equal(window.showCount, 1)
  assert.equal(window.showInactiveCount, 0)
  assert.equal(service.getSnapshot().canCompose, true)
  assert.equal(service.getSnapshot().interactive, true)
  service.hide()
  assert.equal(service.getSnapshot().canCompose, false)
})

test('returns focus when the composer becomes available after a reply', () => {
  const window = fakeWindow()
  const service = new FlyoverService(() => undefined)
  service.attachWindow(window)
  service.show({
    mode: 'assistant',
    phase: 'thinking',
    title: 'میکی',
    text: 'دارم فکر می‌کنم…',
    interactive: true,
    canCompose: false
  })

  service.update({
    phase: 'reply',
    text: 'جواب آماده است.',
    canCompose: true
  })

  assert.equal(window.focusCount, 1)
  assert.equal(service.getSnapshot().canCompose, true)
})

test('clears composer sizing text when composing ends', () => {
  const service = new FlyoverService(() => undefined)
  service.attachWindow(fakeWindow())
  service.show({
    mode: 'assistant',
    phase: 'composing',
    composeText: 'یک پیش‌نویس بلند',
    interactive: true,
    canCompose: true
  })

  service.update({ phase: 'thinking', canCompose: false })

  assert.equal(service.getSnapshot().composeText, null)
})
