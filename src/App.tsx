import {
  Download,
  History,
  MessageSquarePlus,
  Mic,
  MicOff,
  RotateCcw,
  Settings
} from 'lucide-react'
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'
import { useEffect, useState } from 'react'
import { ThinkingOrb, type OrbState } from 'thinking-orbs'
import { AgentReplyView } from '@/components/agent-reply-view'
import { ChatDetailView, ChatHistoryView } from '@/components/chat-history-view'
import { ConversationPreview } from '@/components/conversation-preview'
import { MickyLogo } from '@/components/micky-logo'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle
} from '@/components/ui/empty'
import { OnboardingView } from '@/components/onboarding-view'
import { SettingsView } from '@/components/settings-view'
import { TranscriptView } from '@/components/transcript-view'
import { useAgent } from '@/hooks/use-agent'
import { useConversation } from '@/hooks/use-conversation'
import { useChats } from '@/hooks/use-chats'
import { useModels } from '@/hooks/use-models'
import { useSoul } from '@/hooks/use-soul'
import { useSpeech } from '@/hooks/use-speech'
import { useSettings } from '@/hooks/use-settings'
import { useTurnCues } from '@/hooks/use-turn-cues'
import { useTts } from '@/hooks/use-tts'
import { useWakeWord } from '@/hooks/use-wake-word'
import { cn } from '@/lib/utils'

const PHASE_LABEL = {
  disabled: 'شنیدن خاموش است',
  loading: 'یک لحظه…',
  listening: 'بگو «هی میکی»',
  activated: 'گوش می‌دم…',
  followup: 'ادامه بده…',
  confirm: 'بگو آره یا نه',
  error: 'میکروفن در دسترس نیست'
} as const

const ORB_STATE: Record<keyof typeof PHASE_LABEL, OrbState> = {
  disabled: 'breathing',
  loading: 'connecting',
  listening: 'breathing',
  activated: 'listening',
  followup: 'listening',
  confirm: 'listening',
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

type FooterButtonProps = Omit<React.ComponentProps<typeof Button>, 'aria-label'> & {
  label: string
}

function FooterButton({ label, children, ...props }: FooterButtonProps): React.JSX.Element {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger
        delay={0}
        render={
          <Button
            variant="outline"
            size="icon-lg"
            className="size-11 rounded-xl border-grey-800 text-muted-foreground hover:border-grey-700 [&_svg]:size-5"
            aria-label={label}
            {...props}
          />
        }
      >
        {children}
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side="top" sideOffset={8}>
          <TooltipPrimitive.Popup
            className="z-50 rounded-lg border border-border/70 bg-popover/95 px-2 py-1 text-[0.65rem] text-popover-foreground shadow-lg backdrop-blur-sm data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95"
          >
            {label}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

function App(): React.JSX.Element {
  const [screen, setScreen] = useState<'home' | 'history' | 'chat' | 'settings'>('home')
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const status = useWakeWord()
  const speech = useSpeech()
  const models = useModels()
  const soul = useSoul()
  const settings = useSettings()
  const agent = useAgent()
  const conversation = useConversation()
  const chats = useChats()
  const tts = useTts()
  const onboardingActive = soul?.onboardingCompleted === false
  useTurnCues(conversation)
  useEffect(() => window.api.app.onOpenSettings(() => setScreen('settings')), [])
  useEffect(() => {
    void window.api.app.setWindowMode(
      !onboardingActive && screen === 'settings' ? 'settings' : 'home'
    )
  }, [onboardingActive, screen])
  const phase = status?.phase ?? 'loading'
  const enabled = status?.enabled ?? true
  const isActivated = phase === 'activated'
  const isFollowup = conversation?.mode === 'followup'
  const isConfirm = conversation?.mode === 'confirm' || agent?.phase === 'confirm'
  const followupOpen = isFollowup && !conversation?.followupHeard
  const confirmOpen = isConfirm && !conversation?.followupHeard
  const isLoading = phase === 'loading'
  const hasInstalledModel = models?.models.some((model) => model.state === 'installed') ?? false
  const modelUnavailable = models !== null && !hasInstalledModel
  const transcript = speech?.transcript
  const agentTurn = agent?.turn
  const agentBusy =
    agent?.phase === 'thinking' ||
    agent?.phase === 'tool' ||
    agent?.phase === 'confirm' ||
    agent?.phase === 'speaking'
  const ttsBusy = tts.status.phase === 'synthesizing' || tts.status.phase === 'playing'
  const responseBusy = agentBusy || ttsBusy
  const showAgent =
    Boolean(agentTurn) &&
    (agentBusy || ttsBusy || agent?.phase === 'error' || isFollowup || isConfirm) &&
    !(isActivated && transcript?.text && !transcript.isFinal && !isConfirm)
  const showTranscript = isActivated && Boolean(transcript?.text) && !showAgent
  const showFollowupPrompt = followupOpen && !showTranscript && !responseBusy
  const sessionActive = speech?.phase === 'listening' || speech?.phase === 'loading'
  const error =
    (tts.status.phase === 'error' ? tts.status.error : null) ??
    (showAgent ? agent?.error : null) ??
    (isActivated ? speech?.error : null) ??
    status?.error ??
    null
  const activeChat = chats?.activeChat ?? null
  const hasConversation = Boolean(agentTurn || activeChat)
  const showContinuePrompt =
    !modelUnavailable && hasConversation && !responseBusy && !isActivated && !isFollowup && !error
  const showFreshAction =
    !modelUnavailable &&
    hasConversation &&
    !responseBusy &&
    !showTranscript &&
    (!isActivated || isFollowup)

  const orbState: OrbState = modelUnavailable
    ? 'breathing'
    : tts.status.phase === 'synthesizing'
      ? 'connecting'
      : tts.status.phase === 'playing'
        ? 'composing'
        : agent?.phase === 'thinking'
          ? 'working'
          : agent?.phase === 'tool'
            ? 'searching'
            : agent?.phase === 'confirm'
              ? 'listening'
              : agent?.phase === 'speaking'
                ? 'composing'
                : speech?.phase === 'finalizing' || (isActivated && transcript?.isFinal)
                  ? 'shaping'
                  : speech?.phase === 'listening' || isActivated
                    ? 'listening'
                    : ORB_STATE[phase]

  const handleOrbClick = (): void => {
    if (modelUnavailable) {
      setScreen('settings')
      return
    }
    if (isLoading) return
    if (phase === 'error') {
      void window.api.wakeWord.retry()
      return
    }
    void window.api.wakeWord.activateManually()
  }

  const handleStartFresh = (): void => {
    void window.api.agent.reset()
  }

  const handleOpenChat = (chatId: string): void => {
    setSelectedChatId(chatId)
    setScreen('chat')
  }

  const handleResumeChat = async (chatId: string): Promise<void> => {
    const result = await window.api.chats.resume(chatId)
    if (!result.resumed) return
    setSelectedChatId(null)
    setScreen('home')
    void window.api.wakeWord.activateManually()
  }

  if (onboardingActive && soul) {
    return (
      <OnboardingView
        models={models}
        ttsSnapshot={tts.snapshot}
        existingUserMarkdown={soul.files.user}
        settings={settings}
      />
    )
  }

  if (screen === 'settings') {
    return (
      <SettingsView
        snapshot={models}
        ttsSnapshot={tts.snapshot}
        chatsSnapshot={chats}
        settings={settings}
        sessionActive={sessionActive}
        onBack={() => setScreen('home')}
      />
    )
  }

  if (screen === 'history') {
    return (
      <ChatHistoryView snapshot={chats} onBack={() => setScreen('home')} onOpen={handleOpenChat} />
    )
  }

  if (screen === 'chat' && selectedChatId) {
    const selected = chats?.chats.find((chat) => chat.id === selectedChatId)
    return (
      <ChatDetailView
        chatId={selectedChatId}
        updatedAt={selected?.updatedAt}
        onBack={() => setScreen('history')}
        onResume={(chatId) => void handleResumeChat(chatId)}
        onDeleted={() => {
          setSelectedChatId(null)
          setScreen('history')
        }}
      />
    )
  }

  return (
    <main className="voice-shell flex min-h-full flex-col overflow-hidden text-center">
      <header className="app-titlebar flex items-center justify-center" aria-hidden="true">
        <MickyLogo className="size-5 opacity-55" />
      </header>

      <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-6">
        <div className="flex min-h-9 max-w-80 items-center">
          {modelUnavailable ? (
            <p className="text-xs text-muted-foreground">برای شروع یه مدل شنوا لازمه</p>
          ) : activeChat ? (
            <Button
              variant="ghost"
              size="sm"
              className="max-w-80 text-muted-foreground"
              onClick={() => handleOpenChat(activeChat.id)}
            >
              <span className="truncate">{activeChat.title}</span>
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">همراه کوچیکت برای انجام کارها</p>
          )}
        </div>
        <button
          type="button"
          className="orb-trigger"
          data-phase={
            modelUnavailable
              ? 'disabled'
              : agent?.phase === 'confirm'
                ? 'activated'
                : responseBusy
                  ? 'thinking'
                  : isActivated || isFollowup
                    ? 'activated'
                    : phase
          }
          onClick={handleOrbClick}
          disabled={isLoading && !modelUnavailable}
          aria-label={
            modelUnavailable
              ? 'باز کردن تنظیمات مدل شنوا'
              : responseBusy
                ? 'قطع پاسخ'
                : isFollowup
                  ? 'پایان گفتگو و بازگشت به حالت آماده'
                  : isActivated
                    ? 'پایان شنیدن و بازگشت به حالت آماده'
                    : 'شروع شنیدن'
          }
          aria-pressed={isActivated || responseBusy || isFollowup}
        >
          <span className="orb-aura" aria-hidden="true" />
          {(followupOpen && conversation?.followupUntil) ||
          (confirmOpen && conversation?.followupUntil) ? (
            <FollowupTimer
              key={conversation?.followupUntil}
              until={conversation?.followupUntil ?? 0}
            />
          ) : null}
          <span className="orb-core">
            <ThinkingOrb
              state={orbState}
              size={64}
              theme={settings?.theme === 'light' ? 'light' : 'dark'}
              speed={isActivated || responseBusy || isFollowup ? 1.25 : 0.82}
              paused={
                modelUnavailable || phase === 'disabled' || (phase === 'error' && !responseBusy)
              }
              aria-label={
                modelUnavailable
                  ? 'میکی تا دانلود مدل شنوا غیرفعال است'
                  : responseBusy
                    ? 'میکی در حال جواب‌دادن است'
                    : isFollowup || isActivated
                      ? 'میکی در حال گوش‌دادن است'
                      : 'میکی آماده شنیدن است'
              }
            />
          </span>
        </button>

        <div
          className="flex min-h-16 w-full max-w-80 flex-col items-center gap-3"
          aria-live="polite"
        >
          {modelUnavailable ? (
            <Empty className="gap-2 p-0">
              <EmptyHeader className="gap-1">
                <EmptyTitle>میکی فعلاً غیرفعاله</EmptyTitle>
                <EmptyDescription className="max-w-64">
                  برای شنیدن صدات، اول یه مدل شنوا دانلود کن. بعدش مدل روی همین کامپیوتر اجرا می‌شه.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" onClick={() => setScreen('settings')}>
                  <Download data-icon="inline-start" />
                  دانلود مدل شنوا
                </Button>
              </EmptyContent>
            </Empty>
          ) : showAgent && agentTurn ? (
            <AgentReplyView
              turnId={agentTurn.turnId}
              text={agentTurn.error ?? agentTurn.replyText}
              phase={agentTurn.phase}
              toolName={agentTurn.toolName}
              confirmText={agentTurn.confirmText}
              confirmDetail={agentTurn.confirmDetail}
              dimmed={showFollowupPrompt || showContinuePrompt}
              onApprove={
                isConfirm ? () => window.api.conversation.resolveApproval(true) : undefined
              }
              onDeny={isConfirm ? () => window.api.conversation.resolveApproval(false) : undefined}
            />
          ) : showTranscript && transcript ? (
            <TranscriptView
              sessionId={transcript.sessionId}
              text={transcript.text}
              isFinal={transcript.isFinal}
            />
          ) : activeChat && !error && !isActivated && !isFollowup ? (
            <ConversationPreview chat={activeChat} onOpen={() => handleOpenChat(activeChat.id)} />
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
          {showContinuePrompt ? <p className="followup-hint">{PHASE_LABEL.listening}</p> : null}
          {showFreshAction ? (
            <Button
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              onClick={handleStartFresh}
            >
              گفتگوی تازه
            </Button>
          ) : null}
        </div>
      </section>

      <footer className="flex items-center justify-center gap-1 pb-5">
        <FooterButton
          label="گفتگوهای قبلی"
          onClick={() => setScreen('history')}
        >
          <History />
        </FooterButton>
        {hasConversation && !showFreshAction ? (
          <FooterButton
            label="گفتگوی تازه"
            onClick={handleStartFresh}
          >
            <MessageSquarePlus />
          </FooterButton>
        ) : null}
        {phase === 'error' ? (
          <FooterButton
            label="تلاش دوباره"
            onClick={() => void window.api.wakeWord.retry()}
          >
            <RotateCcw />
          </FooterButton>
        ) : (
          <FooterButton
            label={enabled ? 'خاموش‌کردن شنیدن' : 'روشن‌کردن شنیدن'}
            onClick={() => void window.api.wakeWord.setEnabled(!enabled)}
            aria-pressed={enabled}
          >
            {enabled ? <Mic /> : <MicOff />}
          </FooterButton>
        )}
        <FooterButton
          label="تنظیمات"
          onClick={() => setScreen('settings')}
        >
          <Settings />
        </FooterButton>
      </footer>
    </main>
  )
}

export default App
