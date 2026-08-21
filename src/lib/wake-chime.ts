let playbackContext: AudioContext | null = null
let lastTurnDoneAt = 0

function getPlaybackContext(): AudioContext {
  if (!playbackContext || playbackContext.state === 'closed') {
    playbackContext = new AudioContext({ latencyHint: 'interactive' })
  }
  return playbackContext
}

function playTone(
  context: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  peakGain: number
): void {
  const oscillator = context.createOscillator()
  const harmonic = context.createOscillator()
  const envelope = context.createGain()
  const filter = context.createBiquadFilter()

  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  harmonic.type = 'sine'
  harmonic.frequency.value = frequency * 2

  const harmonicGain = context.createGain()
  harmonicGain.gain.value = 0.18

  filter.type = 'lowpass'
  filter.frequency.value = 2_400
  filter.Q.value = 0.7

  envelope.gain.setValueAtTime(0.0001, start)
  envelope.gain.exponentialRampToValueAtTime(peakGain, start + 0.014)
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration)

  oscillator.connect(envelope)
  harmonic.connect(harmonicGain)
  harmonicGain.connect(envelope)
  envelope.connect(filter)
  filter.connect(context.destination)

  oscillator.start(start)
  harmonic.start(start)
  oscillator.stop(start + duration + 0.02)
  harmonic.stop(start + duration + 0.02)
}

function playWhenReady(play: (context: AudioContext) => void): void {
  const context = getPlaybackContext()
  if (context.state === 'running') {
    play(context)
    return
  }
  void context.resume().then(() => play(context))
}

export function primeWakeChime(): void {
  void getPlaybackContext().resume()
}

export function playWakeChime(): void {
  playWhenReady((context) => {
    const now = context.currentTime
    playTone(context, 587.33, now, 0.1, 0.055)
    playTone(context, 880, now + 0.075, 0.18, 0.07)
  })
}

export function playTurnDoneChime(): void {
  lastTurnDoneAt = performance.now()
  playWhenReady((context) => {
    const now = context.currentTime
    playTone(context, 783.99, now, 0.12, 0.05)
    playTone(context, 523.25, now + 0.11, 0.2, 0.062)
  })
}

export function playListenChime(): void {
  const waitMs = Math.max(0, 240 - (performance.now() - lastTurnDoneAt))
  const trigger = (): void => {
    playWhenReady((context) => {
      const now = context.currentTime
      playTone(context, 523.25, now, 0.08, 0.04)
      playTone(context, 698.46, now + 0.07, 0.16, 0.058)
    })
  }

  if (waitMs === 0) {
    trigger()
    return
  }
  window.setTimeout(trigger, waitMs)
}

export function playConfirmChime(): void {
  playWhenReady((context) => {
    const now = context.currentTime
    playTone(context, 659.25, now, 0.09, 0.048)
    playTone(context, 830.61, now + 0.09, 0.12, 0.06)
    playTone(context, 987.77, now + 0.2, 0.2, 0.05)
  })
}
