import type { FlyoverPhase } from '@/lib/flyover'

export const FLYOVER_COMPOSE_MAX = 4_000
export const FLYOVER_COMPOSE_HINT = 'Enter بفرست • Esc بی‌خیال'
export const FLYOVER_TYPED_IDLE_MS = 90_000

export function clampFlyoverDraft(text: string): string {
  return text.slice(0, FLYOVER_COMPOSE_MAX)
}

export function shouldIgnoreFlyoverSpeech(composing: boolean): boolean {
  return composing
}

export function canAcceptFlyoverCompose(input: {
  active: boolean
  shortcutSession: boolean
  phase: FlyoverPhase
  canApprove: boolean
}): boolean {
  if (!input.active || !input.shortcutSession || input.canApprove) return false
  return input.phase === 'listening' || input.phase === 'reply' || input.phase === 'composing'
}
