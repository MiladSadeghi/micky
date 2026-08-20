import assert from 'node:assert/strict'
import test from 'node:test'
import type { BrowserWindow } from 'electron'
import { FlyoverService } from './service'

function fakeWindow(): BrowserWindow {
  return {
    isDestroyed: () => false,
    setFocusable: () => undefined,
    show: () => undefined,
    showInactive: () => undefined,
    hide: () => undefined,
    webContents: {
      once: () => undefined,
      send: () => undefined
    }
  } as unknown as BrowserWindow
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
    canFinish: true
  })
  assert.equal(service.getSnapshot().visible, true)
  assert.equal(service.getSnapshot().canFinish, true)
  service.hide()
  assert.deepEqual(
    {
      visible: service.getSnapshot().visible,
      phase: service.getSnapshot().phase,
      interactive: service.getSnapshot().interactive,
      canFinish: service.getSnapshot().canFinish
    },
    { visible: false, phase: 'hidden', interactive: false, canFinish: false }
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
