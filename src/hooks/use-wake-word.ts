import { useEffect, useRef, useState } from 'react'
import type { WakeWordStatus } from '@/lib/wake-word'
import { playWakeChime, primeWakeChime } from '@/lib/wake-chime'

type CaptureSession = {
  context: AudioContext
  stream: MediaStream
  source: MediaStreamAudioSourceNode
  processor: AudioWorkletNode
  output: GainNode
}

function stopCaptureSession(session: CaptureSession): void {
  session.processor.port.onmessage = null
  session.processor.disconnect()
  session.source.disconnect()
  session.output.disconnect()
  for (const track of session.stream.getTracks()) track.stop()
  void session.context.close().catch(() => undefined)
}

function describeCaptureError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'برای شنیدن عبارت بیدارباش، دسترسی میکروفن را به میکی بده.'
  }
  if (
    error instanceof DOMException &&
    (error.name === 'NotFoundError' || error.name === 'OverconstrainedError')
  ) {
    return 'میکروفنی برای شنیدن عبارت بیدارباش پیدا نشد.'
  }
  return error instanceof Error ? error.message : 'شروع شنیدن عبارت بیدارباش ناموفق بود.'
}

export function useWakeWord(): WakeWordStatus | null {
  const [status, setStatus] = useState<WakeWordStatus | null>(null)
  const sessionRef = useRef<CaptureSession | null>(null)
  const generationRef = useRef(0)

  useEffect(() => {
    let active = true
    void window.api.wakeWord.getStatus().then((next) => {
      if (active) setStatus(next)
    })
    const unsubscribe = window.api.wakeWord.onStatusChange((next) => {
      if (active) setStatus(next)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    return window.api.wakeWord.onActivation((activation) => {
      if (activation.source === 'wake-word') playWakeChime()
    })
  }, [])

  useEffect(() => {
    const generation = ++generationRef.current
    const previousSession = sessionRef.current
    sessionRef.current = null
    if (previousSession) stopCaptureSession(previousSession)
    if (!status?.captureRequested) return

    let stream: MediaStream | null = null
    let context: AudioContext | null = null

    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            autoGainControl: false,
            channelCount: 1,
            echoCancellation: false,
            noiseSuppression: false,
            sampleRate: 16_000
          },
          video: false
        })
        if (generationRef.current !== generation) {
          for (const track of stream.getTracks()) track.stop()
          return
        }

        context = new AudioContext({ latencyHint: 'interactive', sampleRate: 16_000 })
        const workletUrl = new URL('wake-word-audio-worklet.js', document.baseURI).href
        await context.audioWorklet.addModule(workletUrl)
        await context.resume()
        primeWakeChime()
        if (context.sampleRate !== 16_000) {
          throw new Error('صدای میکروفن نتوانست با نرخ ۱۶ کیلوهرتز آماده شود.')
        }

        const source = context.createMediaStreamSource(stream)
        const processor = new AudioWorkletNode(context, 'micky-wake-word-processor', {
          channelCount: 1,
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1]
        })
        const output = context.createGain()
        output.gain.value = 0
        processor.port.onmessage = (event: MessageEvent<unknown>) => {
          if (event.data instanceof ArrayBuffer) {
            window.api.wakeWord.processAudio(event.data)
          }
        }
        source.connect(processor)
        processor.connect(output)
        output.connect(context.destination)

        if (generationRef.current !== generation) {
          stopCaptureSession({ context, stream, source, processor, output })
          return
        }
        sessionRef.current = { context, stream, source, processor, output }
      } catch (error) {
        if (stream) {
          for (const track of stream.getTracks()) track.stop()
        }
        if (context) void context.close().catch(() => undefined)
        if (generationRef.current === generation) {
          window.api.wakeWord.reportCaptureError(describeCaptureError(error))
        }
      }
    })()

    return () => {
      generationRef.current += 1
      const session = sessionRef.current
      sessionRef.current = null
      if (session) stopCaptureSession(session)
      if (stream && !session) {
        for (const track of stream.getTracks()) track.stop()
      }
      if (context && !session) void context.close().catch(() => undefined)
    }
  }, [status?.captureRequested])

  return status
}
