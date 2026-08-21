import { useEffect } from 'react'
import type { EarconKind } from '@/lib/earcon'
import { playConfirmChime, playListenChime, primeWakeChime } from '@/lib/wake-chime'

export function useEarcons(subscribe: (listener: (kind: EarconKind) => void) => () => void): void {
  useEffect(() => {
    primeWakeChime()
    return subscribe((kind) => {
      if (kind === 'confirm') playConfirmChime()
      else playListenChime()
    })
  }, [subscribe])
}