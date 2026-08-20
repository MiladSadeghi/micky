import type { WakeWordActivation } from '@/lib/wake-word'

export function shouldShowWakeFlyover(
  activation: WakeWordActivation,
  mainWindowFocused: boolean
): boolean {
  return activation.source === 'wake-word' && !mainWindowFocused
}
