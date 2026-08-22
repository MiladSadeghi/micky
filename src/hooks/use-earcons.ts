import { useEffect } from 'react'
import type { EarconKind } from '@/lib/earcon'
import {
  playConfirmChime,
  playListenChime,
  primeWakeChime,
  setEarconOutputDevice
} from '@/lib/wake-chime'
import { DEFAULT_AUDIO_DEVICE_ID } from '@/lib/settings'

export function useEarcons(
  subscribe: (listener: (kind: EarconKind) => void) => () => void,
  outputDeviceId = DEFAULT_AUDIO_DEVICE_ID
): void {
  useEffect(() => setEarconOutputDevice(outputDeviceId), [outputDeviceId])
  useEffect(() => {
    primeWakeChime()
    return subscribe((kind) => {
      if (kind === 'confirm') playConfirmChime()
      else playListenChime()
    })
  }, [subscribe])
}
