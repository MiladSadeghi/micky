import { Mic, MicOff, RotateCcw, Settings } from 'lucide-react'
import { useState } from 'react'
import { ThinkingOrb, type OrbState } from 'thinking-orbs'
import { AgentReplyView } from '@/components/agent-reply-view'
import { Button } from '@/components/ui/button'
import { OnboardingView } from '@/components/onboarding-view'
import { SettingsView } from '@/components/settings-view'
import { TranscriptView } from '@/components/transcript-view'
import { useAgent } from '@/hooks/use-agent'
import { useConversation } from '@/hooks/use-conversation'
import { useModels } from '@/hooks/use-models'
import { useSoul } from '@/hooks/use-soul'
import { useSpeech } from '@/hooks/use-speech'
import { useTurnCues } from '@/hooks/use-turn-cues'
import { useWakeWord } from '@/hooks/use-wake-word'
import { cn } from '@/lib/utils'

const PHASE_LABEL = {
  disabled: 'شنیدن خاموش است',
  loading: 'یک لحظه…',
  listening: 'بگو «هی میکی»',
  activated: 'گوش می‌دم…',
  followup: 'ادامه بده…',
  error: 'میکروفن در دسترس نیست'
} as const

const ORB_STATE: Record<keyof typeof PHASE_LABEL, OrbState> = {
  disabled: 'breathing',
  loading: 'connecting',
  listening: 'breathing',
  activated: 'listening',
  followup: 'listening',
  error: 'shaping'
}

function FollowupTimer({ until }: { until: number }): React.JSX.Element {
  const [durationMs] = useState(() => Math.max(320, until - Date.now()))
  return (
    <svg
      className="orb-followup-timer"
      viewBox="0 0 100 100"
      aria-hidden="true"
      style={{ '--followup-ms': `${durationMs}ms` } as React.CSSProperties}
    >
      <circle cx="50" cy="50" r="48.2" pathLength="100" />
    </svg>
  )
}

function App(): React.JSX.Element {
  const [screen, setScreen] = useState<'home' | 'settings'>('home')
  const status = useWakeWord()
  const speech = useSpeech()
  const models = useModels()
  const soul = useSoul()
  const agent = useAgent()
  const conversation = useConversation()
  useTurnCues(conversation)
  const phase = status?.phase ?? 'loading'
  const enabled = status?.enabled ?? true
  const isActivated = phase === 'activated'
  const isFollowup = conversation?.mode === 'followup'
  const followupOpen = isFollowup && !conversation?.followupHeard
  const isLoading = phase === 'loading'
  const hasInstalledModel = models?.models.some((model) => model.state === 'installed') ?? false
  const transcript = speech?.transcript
  const agentTurn = agent?.turn
  const agentBusy =
    agent?.phase === 'thinking' || agent?.phase === 'tool' || agent?.phase === 'speaking'
  const showAgent =
    Boolean(agentTurn) &&
    (agentBusy || agent?.phase === 'error' || Boolean(agentTurn?.replyText)) &&
    !(isActivated && transcript?.text && !transcript.isFinal)
  const showTranscript = isActivated && Boolean(transcript?.text) && !showAgent
  const showFollowupPrompt = followupOpen && !showTranscript && !agentBusy
  const sessionActive = speech?.phase === 'listening' || speech?.phase === 'loading'
  const error =
    (showAgent ? agent?.error : null) ??
    (isActivated ? speech?.error : null) ??
    status?.error ??
    null

  const orbState: OrbState =
    agent?.phase === 'thinking'
      ? 'working'
      : agent?.phase === 'tool'
        ? 'searching'
        : agent?.phase === 'speaking'
          ? 'composing'
          : speech?.phase === 'finalizing' || (isActivated && transcript?.isFinal)
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

  if (soul && !soul.onboardingCompleted) {
    return <OnboardingView />
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
          data-phase={agentBusy ? 'thinking' : isActivated || isFollowup ? 'activated' : phase}
          onClick={handleOrbClick}
          disabled={isLoading}
          aria-label={
            agentBusy
              ? 'قطع پاسخ'
              : isFollowup
                ? 'پایان گفتگو و بازگشت به حالت آماده'
                : isActivated
                  ? 'پایان شنیدن و بازگشت به حالت آماده'
                  : 'شروع شنیدن'
          }
          aria-pressed={isActivated || agentBusy || isFollowup}
        >
          <span className="orb-aura" aria-hidden="true" />
          {followupOpen && conversation?.followupUntil ? (
            <FollowupTimer key={conversation.followupUntil} until={conversation.followupUntil} />
          ) : null}
          <span className="orb-core">
            <ThinkingOrb
              state={orbState}
              size={64}
              theme="dark"
              speed={isActivated || agentBusy || isFollowup ? 1.25 : 0.82}
              paused={phase === 'disabled' || (phase === 'error' && !agentBusy)}
              aria-label={
                agentBusy
                  ? 'میکی در حال جواب‌دادن است'
                  : isFollowup || isActivated
                    ? 'میکی در حال گوش‌دادن است'
                    : 'میکی آماده شنیدن است'
              }
            />
          </span>
        </button>

        <div className="flex min-h-16 max-w-72 flex-col items-center gap-3" aria-live="polite">
          {showAgent && agentTurn ? (
            <AgentReplyView
              turnId={agentTurn.turnId}
              text={agentTurn.error ?? agentTurn.replyText}
              phase={agentTurn.phase}
              awaitingFollowup={showFollowupPrompt}
            />
          ) : showTranscript && transcript ? (
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
              {error ?? (showFollowupPrompt ? PHASE_LABEL.followup : PHASE_LABEL[phase])}
            </p>
          )}
          {showFollowupPrompt && showAgent ? (
            <p className="followup-hint">{PHASE_LABEL.followup}</p>
          ) : null}
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
