import { useEffect, useRef, useState } from 'react'
import { copyPlaybackAudio, INITIAL_TTS_STATUS, type TtsSnapshot, type TtsStatus } from '@/lib/tts'
import { DEFAULT_AUDIO_DEVICE_ID } from '@/lib/settings'

type ActiveAudio = {
  id: string
  audio: HTMLAudioElement
  url: string
}

async function applyOutputDevice(audio: HTMLAudioElement, deviceId: string): Promise<void> {
  if (typeof audio.setSinkId !== 'function') return
  try {
    await audio.setSinkId(deviceId)
  } catch {
    if (deviceId !== DEFAULT_AUDIO_DEVICE_ID) await audio.setSinkId(DEFAULT_AUDIO_DEVICE_ID)
  }
}

export function useTts(outputDeviceId = DEFAULT_AUDIO_DEVICE_ID): {
  status: TtsStatus
  snapshot: TtsSnapshot | null
} {
  const [status, setStatus] = useState<TtsStatus>(INITIAL_TTS_STATUS)
  const [snapshot, setSnapshot] = useState<TtsSnapshot | null>(null)
  const activeAudio = useRef<ActiveAudio | null>(null)

  useEffect(() => {
    let mounted = true
    void window.api.tts.getStatus().then((next) => {
      if (mounted) setStatus(next)
    })
    void window.api.tts.getSnapshot().then((next) => {
      if (mounted) setSnapshot(next)
    })

    const clearAudio = (): void => {
      const active = activeAudio.current
      if (!active) return
      active.audio.pause()
      active.audio.removeAttribute('src')
      URL.revokeObjectURL(active.url)
      activeAudio.current = null
    }

    const stopStatus = window.api.tts.onStatusChange((next) => {
      if (mounted) setStatus(next)
    })
    const stopSnapshot = window.api.tts.onSnapshotChange((next) => {
      if (mounted) setSnapshot(next)
    })
    const stopPlayback = window.api.tts.onPlayback((playback) => {
      clearAudio()
      let finished = false
      const finish = (error?: string): void => {
        if (finished) return
        finished = true
        if (activeAudio.current?.id === playback.id) clearAudio()
        window.api.tts.playbackFinished(playback.id, error)
      }
      const audioBytes = copyPlaybackAudio(playback.audio)
      if (audioBytes.byteLength === 0) {
        finish('صدای ساخته‌شده خالی بود.')
        return
      }
      const blob = new Blob([audioBytes], { type: playback.mimeType || 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const audio = new Audio()
      activeAudio.current = { id: playback.id, audio, url }
      audio.addEventListener('ended', () => finish(), { once: true })
      audio.addEventListener('error', () => finish('پخش صدای ساخته‌شده ممکن نشد.'), {
        once: true
      })
      audio.src = url
      void applyOutputDevice(audio, outputDeviceId)
        .then(() => audio.play())
        .catch((error: unknown) => {
          finish(error instanceof Error ? error.message : 'پخش صدا ممکن نشد.')
        })
    })
    const stopStop = window.api.tts.onStop((id) => {
      if (activeAudio.current?.id === id) clearAudio()
    })

    return () => {
      mounted = false
      clearAudio()
      stopStatus()
      stopSnapshot()
      stopPlayback()
      stopStop()
    }
  }, [outputDeviceId])

  return { status, snapshot }
}
