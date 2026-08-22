import { useCallback, useEffect, useState } from 'react'
import { toAudioDeviceOptions, type AudioDeviceOption } from '@/lib/audio-devices'

export type AudioDevices = {
  inputs: AudioDeviceOption[]
  outputs: AudioDeviceOption[]
  loading: boolean
  error: string | null
  requestAccess: () => Promise<void>
  refresh: () => Promise<void>
}

export function useAudioDevices(): AudioDevices {
  const [inputs, setInputs] = useState<AudioDeviceOption[]>([])
  const [outputs, setOutputs] = useState<AudioDeviceOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      setInputs(toAudioDeviceOptions(devices, 'audioinput'))
      setOutputs(toAudioDeviceOptions(devices, 'audiooutput'))
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'پیداکردن دستگاه‌های صدا ممکن نشد.')
    } finally {
      setLoading(false)
    }
  }, [])

  const requestAccess = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      for (const track of stream.getTracks()) track.stop()
      await refresh()
    } catch (cause) {
      setError(
        cause instanceof DOMException && cause.name === 'NotAllowedError'
          ? 'برای دیدن نام میکروفن‌ها، دسترسی میکروفن را به میکی بده.'
          : cause instanceof Error
            ? cause.message
            : 'دسترسی به میکروفن ممکن نشد.'
      )
      setLoading(false)
    }
  }, [refresh])

  useEffect(() => {
    void refresh()
    const handleDeviceChange = (): void => void refresh()
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
    return () => navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
  }, [refresh])

  return { inputs, outputs, loading, error, requestAccess, refresh }
}
