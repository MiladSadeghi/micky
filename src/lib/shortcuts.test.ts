import assert from 'node:assert/strict'
import test from 'node:test'
import {
  shortcutDisplayKeys,
  shortcutFromKeyboardEvent,
  shortcutPlatformLabel,
  shortcutPreviewKeys,
  type ShortcutKeyboardEvent
} from './shortcuts'

function keyboardEvent(patch: Partial<ShortcutKeyboardEvent>): ShortcutKeyboardEvent {
  return {
    key: 'K',
    code: 'KeyK',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...patch
  }
}

test('renders Electron accelerators as platform-native keycaps', () => {
  assert.deepEqual(shortcutDisplayKeys('CommandOrControl+Shift+Space', 'macos'), [
    '⌘',
    '⇧',
    'Space'
  ])
  assert.deepEqual(shortcutDisplayKeys('CommandOrControl+Shift+Space', 'windows'), [
    'Ctrl',
    'Shift',
    'Space'
  ])
  assert.equal(shortcutPlatformLabel('linux'), 'Linux · Ctrl')
})

test('keeps Command and Control distinct on macOS', () => {
  assert.equal(
    shortcutFromKeyboardEvent(keyboardEvent({ metaKey: true, shiftKey: true }), 'macos'),
    'Command+Shift+K'
  )
  assert.equal(
    shortcutFromKeyboardEvent(keyboardEvent({ ctrlKey: true, shiftKey: true }), 'macos'),
    'Control+Shift+K'
  )
})

test('records Windows shortcuts and previews held modifiers', () => {
  assert.equal(
    shortcutFromKeyboardEvent(keyboardEvent({ ctrlKey: true, altKey: true }), 'windows'),
    'Control+Alt+K'
  )
  assert.deepEqual(
    shortcutPreviewKeys(
      keyboardEvent({ key: 'Control', code: 'ControlLeft', ctrlKey: true }),
      'windows'
    ),
    ['Ctrl']
  )
  assert.equal(shortcutFromKeyboardEvent(keyboardEvent({}), 'windows'), null)
})
