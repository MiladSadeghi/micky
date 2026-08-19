import { Mic, MicOff, RotateCcw, Settings } from 'lucide-react'
import { useState } from 'react'
import { ThinkingOrb, type OrbState } from 'thinking-orbs'
import { Button } from '@/components/ui/button'
import { SettingsView } from '@/components/settings-view'
import { TranscriptView } from '@/components/transcript-view'
import { useModels } from '@/hooks/use-models'
import { useSpeech } from '@/hooks/use-speech'
import { useWakeWord } from '@/hooks/use-wake-word'
import { cn } from '@/lib/utils'

const PHASE_LABEL = {
  disabled: 'شنیدن خاموش است',
  loading: 'یک لحظه…',
  listening: 'بگو «هی نیمروز»',
  activated: 'گوش می‌دم…',
  error: 'میکروفن در دسترس نیست'
} as const

const ORB_STATE: Record<keyof typeof PHASE_LABEL, OrbState> = {
  disabled: 'breathing',
  loading: 'connecting',
  listening: 'breathing',
  activated: 'listening',
  error: 'shaping'
}

function App(): React.JSX.Element {
  const [screen, setScreen] = useState<'home' | 'settings'>('home')
  const status = useWakeWord()
  const speech = useSpeech()
  const models = useModels()
  const phase = status?.phase ?? 'loading'
  const enabled = status?.enabled ?? true
  const isActivated = phase === 'activated'
  const isLoading = phase === 'loading'
  const hasInstalledModel = models?.models.some((model) => model.state === 'installed') ?? false
  const transcript = speech?.transcript
  const showTranscript = isActivated && Boolean(transcript?.text)
  const sessionActive = speech?.phase === 'listening' || speech?.phase === 'loading'
  const error = (isActivated ? speech?.error : null) ?? status?.error ?? null

  const orbState: OrbState =
    speech?.phase === 'finalizing' || (isActivated && transcript?.isFinal)
      ? 'shaping'
      : speech?.phase === 'listening' || isActivated
        ? 'listening'
        : ORB_STATE[phase]

  const handleOrbClick = (): void => {
    if (isLoading) return
    if (phase === 'error') {
      void window.api.wakeWord.retry()
      return
    }
    void window.api.wakeWord.activateManually()
  }

  if (screen === 'settings') {
    return (
      <SettingsView
        snapshot={models}
        sessionActive={sessionActive}
        onBack={() => setScreen('home')}
      />
    )
  }

  return (
    <main className="voice-shell flex min-h-full flex-col overflow-hidden text-center">
      <header className="app-titlebar" aria-hidden="true" />

      <section className="flex flex-1 flex-col items-center justify-center gap-9 px-6">
        <button
          type="button"
          className="orb-trigger"
          data-phase={isActivated ? 'activated' : phase}
          onClick={handleOrbClick}
          disabled={isLoading}
          aria-label={isActivated ? 'پایان شنیدن و بازگشت به حالت آماده' : 'شروع شنیدن'}
          aria-pressed={isActivated}
        >
          <span className="orb-aura" aria-hidden="true" />
          <span className="orb-core">
            <ThinkingOrb
              state={orbState}
              size={64}
              theme="dark"
              speed={isActivated ? 1.25 : 0.82}
              paused={phase === 'disabled' || phase === 'error'}
              aria-label={isActivated ? 'میکی در حال گوش‌دادن است' : 'میکی آماده شنیدن است'}
            />
          </span>
        </button>

        <div className="flex min-h-16 max-w-72 flex-col items-center gap-3" aria-live="polite">
          {showTranscript && transcript ? (
            <TranscriptView
              sessionId={transcript.sessionId}
              text={transcript.text}
              isFinal={transcript.isFinal}
            />
          ) : (
            <p
              className={cn(
                'text-[1.15rem] font-medium tracking-[-0.035em]',
                error && 'text-sm font-normal leading-6 text-muted-foreground'
              )}
            >
              {error ?? PHASE_LABEL[phase]}
            </p>
          )}
          {!hasInstalledModel && !error ? (
            <Button
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              onClick={() => setScreen('settings')}
            >
              دانلود مدل شنوا
            </Button>
          ) : null}
        </div>
      </section>

      <footer className="flex items-center justify-center gap-1 pb-5">
        {phase === 'error' ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            onClick={() => void window.api.wakeWord.retry()}
            aria-label="تلاش دوباره"
          >
            <RotateCcw />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            onClick={() => void window.api.wakeWord.setEnabled(!enabled)}
            aria-label={enabled ? 'خاموش‌کردن شنیدن' : 'روشن‌کردن شنیدن'}
            aria-pressed={enabled}
          >
            {enabled ? <Mic /> : <MicOff />}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          onClick={() => setScreen('settings')}
          aria-label="تنظیمات"
        >
          <Settings />
        </Button>
      </footer>
    </main>
  )
}

export default App
