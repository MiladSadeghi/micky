let playbackContext: AudioContext | null = null

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

export function primeWakeChime(): void {
  void getPlaybackContext().resume()
}

export function playWakeChime(): void {
  const context = getPlaybackContext()
  const play = (): void => {
    const now = context.currentTime
    playTone(context, 587.33, now, 0.1, 0.055)
    playTone(context, 880, now + 0.075, 0.18, 0.07)
  }

  if (context.state === 'running') {
    play()
    return
  }

  void context.resume().then(play)
}
