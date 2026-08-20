export type DesktopPlatform = 'macos' | 'windows' | 'linux'

export type ShortcutKeyboardEvent = {
  key: string
  code: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}

const MODIFIER_KEYS = new Set(['Control', 'Meta', 'Shift', 'Alt'])

export function shortcutPlatformLabel(platform: DesktopPlatform): string {
  if (platform === 'macos') return 'macOS · ⌘'
  if (platform === 'windows') return 'Windows · Ctrl'
  return 'Linux · Ctrl'
}

export function shortcutDisplayKeys(accelerator: string, platform: DesktopPlatform): string[] {
  return accelerator
    .split('+')
    .map((key) => key.trim())
    .filter(Boolean)
    .map((key) => displayKey(key, platform))
}

export function shortcutAccessibleLabel(accelerator: string, platform: DesktopPlatform): string {
  return shortcutDisplayKeys(accelerator, platform).join(' + ')
}

export function shortcutFromKeyboardEvent(
  event: ShortcutKeyboardEvent,
  platform: DesktopPlatform
): string | null {
  if (MODIFIER_KEYS.has(event.key)) return null
  if (!event.ctrlKey && !event.metaKey && !event.altKey) return null

  const modifiers = acceleratorModifiers(event, platform)
  const key = acceleratorKey(event)
  if (!key) return null
  return [...modifiers, key].join('+')
}

export function shortcutPreviewKeys(
  event: ShortcutKeyboardEvent,
  platform: DesktopPlatform
): string[] {
  const accelerator = shortcutFromKeyboardEvent(event, platform)
  const keys = accelerator ? accelerator.split('+') : acceleratorModifiers(event, platform)
  return keys.map((key) => displayKey(key, platform))
}

function acceleratorModifiers(event: ShortcutKeyboardEvent, platform: DesktopPlatform): string[] {
  const modifiers: string[] = []
  if (platform === 'macos') {
    if (event.metaKey) modifiers.push('Command')
    if (event.ctrlKey) modifiers.push('Control')
  } else {
    if (event.ctrlKey) modifiers.push('Control')
    if (event.metaKey) modifiers.push('Super')
  }
  if (event.altKey) modifiers.push('Alt')
  if (event.shiftKey) modifiers.push('Shift')
  return modifiers
}

function acceleratorKey(event: ShortcutKeyboardEvent): string | null {
  if (event.code === 'Space' || event.key === ' ') return 'Space'
  if (event.key === '+') return 'Plus'
  if (event.key === 'Dead' || event.key === 'Process' || event.key === 'Unidentified') return null
  return event.key.length === 1 ? event.key.toUpperCase() : event.key
}

function displayKey(key: string, platform: DesktopPlatform): string {
  const normalized = key.toLowerCase()
  if (normalized === 'commandorcontrol' || normalized === 'cmdorctrl') {
    return platform === 'macos' ? '⌘' : 'Ctrl'
  }
  if (normalized === 'command' || normalized === 'cmd') return '⌘'
  if (normalized === 'control' || normalized === 'ctrl') {
    return platform === 'macos' ? '⌃' : 'Ctrl'
  }
  if (normalized === 'alt' || normalized === 'option') return platform === 'macos' ? '⌥' : 'Alt'
  if (normalized === 'shift') return platform === 'macos' ? '⇧' : 'Shift'
  if (normalized === 'super') return platform === 'windows' ? 'Win' : 'Super'
  if (normalized === 'space') return 'Space'
  if (normalized === 'plus') return '+'
  if (normalized === 'return') return 'Enter'
  return key
}
