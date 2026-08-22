import {
  ArrowUp,
  Check,
  ChevronDown,
  Download,
  Eye,
  Keyboard,
  Mic,
  MicOff,
  Sparkles,
  Square,
  X
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ThinkingOrb, type OrbState } from 'thinking-orbs'
import { INITIAL_FLYOVER_SNAPSHOT, type FlyoverSnapshot } from '@/lib/flyover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { applyAppearance } from '@/lib/appearance'
import { DEFAULT_FONT_FAMILY, DEFAULT_THEME, type AppearanceSnapshot } from '@/lib/settings'
import { useEarcons } from '@/hooks/use-earcons'
import { useTypewriter } from '@/hooks/use-typewriter'
import { getFlyoverLayout } from '@/lib/flyover-layout'
import { detectTextDirection } from '@/lib/text-direction'
import { playConfirmChime } from '@/lib/wake-chime'

const FLYOVER_ORB_STATE: Record<FlyoverSnapshot['phase'], OrbState> = {
  hidden: 'breathing',
  listening: 'listening',
  thinking: 'working',
  tool: 'searching',
  confirm: 'listening',
  cleaning: 'shaping',
  capturing: 'searching',
  looking: 'searching',
  disclosure: 'listening',
  composing: 'composing',
  reply: 'composing',
  done: 'breathing',
  unavailable: 'breathing',
  error: 'shaping'
}

function isImeKey(event: { nativeEvent: { isComposing: boolean }; keyCode: number }): boolean {
  return event.nativeEvent.isComposing || event.keyCode === 229
}

function updateCopyScrollState(element: HTMLDivElement): void {
  if (element.scrollTop > 1) element.dataset.canScrollUp = 'true'
  else delete element.dataset.canScrollUp
}

function FlyoverCopy({ text, animate }: { text: string; animate: boolean }): React.JSX.Element {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const shouldFollowRef = useRef(true)
  const shown = useTypewriter(text, animate)

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    if (shouldFollowRef.current) el.scrollTop = el.scrollHeight
    updateCopyScrollState(el)
  }, [shown])

  useEffect(() => {
    shouldFollowRef.current = true
  }, [text])

  return (
    <div
      ref={scrollerRef}
      className="flyover-copy"
      onScroll={(event) => {
        const el = event.currentTarget
        shouldFollowRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 8
        updateCopyScrollState(el)
      }}
    >
      <p dir={detectTextDirection(text)}>{shown || '…'}</p>
    </div>
  )
}

function FlyoverCompose({
  draft,
  onDraftChange,
  onSubmit
}: {
  draft: string
  onDraftChange: (text: string) => void
  onSubmit: () => void
}): React.JSX.Element {
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const focus = (): void => inputRef.current?.focus()
    focus()
    window.addEventListener('focus', focus)
    return () => window.removeEventListener('focus', focus)
  }, [])

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [draft])

  return (
    <div className="flyover-compose-shell">
      <span
        className={cn(
          'mb-0.5 grid size-6 shrink-0 place-items-center rounded-full transition-colors',
          draft.length > 0
            ? 'text-muted-foreground'
            : 'bg-foreground/10 text-foreground ring-1 ring-foreground/10'
        )}
        title={draft.length > 0 ? 'در حال نوشتن' : 'میکروفن فعاله'}
      >
        {draft.length > 0 ? (
          <Keyboard className="size-3.5" aria-hidden="true" />
        ) : (
          <Mic className="size-3.5" aria-hidden="true" />
        )}
      </span>
      <textarea
        ref={inputRef}
        className="flyover-compose"
        value={draft}
        rows={1}
        dir={detectTextDirection(draft)}
        placeholder="بنویس یا حرف بزن…"
        aria-label="پیام برای میکی؛ بنویس یا حرف بزن"
        autoFocus
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={(event) => {
          if (isImeKey(event)) return
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            onSubmit()
          }
        }}
      />
      <Button
        size="icon-xs"
        className="shrink-0 rounded-full"
        aria-label="ارسال پیام"
        disabled={!draft.trim()}
        onClick={onSubmit}
      >
        <ArrowUp />
      </Button>
    </div>
  )
}

export function FlyoverApp(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<FlyoverSnapshot>(INITIAL_FLYOVER_SNAPSHOT)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [appearance, setAppearance] = useState<AppearanceSnapshot>({
    theme: DEFAULT_THEME,
    fontFamily: DEFAULT_FONT_FAMILY
  })
  const previousPhase = useRef(snapshot.phase)
  const [draft, setDraft] = useState('')
  const composing = snapshot.phase === 'composing'
  const showComposer =
    snapshot.visible && snapshot.canCompose && snapshot.mode === 'assistant' && !snapshot.canApprove

  useEarcons(window.flyoverApi.onEarcon)

  useEffect(() => {
    void window.flyoverApi.getSnapshot().then(setSnapshot)
    return window.flyoverApi.onSnapshotChange(setSnapshot)
  }, [])

  useEffect(() => {
    const update = (next: AppearanceSnapshot): void => {
      applyAppearance(next)
      setAppearance(next)
    }
    void window.flyoverApi.getAppearance().then(update)
    return window.flyoverApi.onAppearanceChange(update)
  }, [])

  useEffect(() => {
    setDetailsOpen(false)
  }, [snapshot.detail, snapshot.phase])

  useEffect(() => {
    const prev = previousPhase.current
    previousPhase.current = snapshot.phase
    if (snapshot.visible && snapshot.phase === 'disclosure' && prev !== 'disclosure') {
      playConfirmChime()
    }
  }, [snapshot.visible, snapshot.phase])

  useEffect(() => {
    if (!showComposer) setDraft('')
  }, [showComposer])

  useEffect(() => {
    if (!snapshot.visible || snapshot.phase === 'confirm') return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.isComposing) return
      event.preventDefault()
      window.flyoverApi.cancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [snapshot.visible, snapshot.phase])

  const Icon =
    snapshot.phase === 'unavailable'
      ? MicOff
      : snapshot.mode === 'screen'
        ? Eye
        : snapshot.phase === 'reply' || snapshot.phase === 'cleaning'
          ? Sparkles
          : Mic
  const active = [
    'listening',
    'thinking',
    'tool',
    'cleaning',
    'capturing',
    'looking',
    'composing'
  ].includes(snapshot.phase)
  const hasActions =
    snapshot.canFinish ||
    snapshot.canApprove ||
    snapshot.canRespondToDisclosure ||
    snapshot.canOpenModels
  const layout = getFlyoverLayout(
    snapshot.detail ? `${snapshot.text}\n${snapshot.detail}` : snapshot.text
  )

  return (
    <main className="flex h-full items-start justify-center p-2" dir="rtl">
      <section
        className="flyover-surface flex w-full flex-col gap-3 rounded-[1.5rem] border border-border/70 bg-card/95 px-3.5 py-3.5 shadow-2xl backdrop-blur-xl"
        data-layout={layout}
        aria-live="polite"
      >
        <div className="flex w-full items-start gap-3.5">
          <span
            className={cn(
              'flyover-orb-well grid size-20 shrink-0 place-items-center rounded-full transition-colors',
              snapshot.phase === 'confirm' ? 'bg-foreground text-background' : 'bg-foreground/10'
            )}
            data-active={active}
          >
            {snapshot.mode === 'assistant' ? (
              <ThinkingOrb
                state={FLYOVER_ORB_STATE[snapshot.phase]}
                size={64}
                theme={snapshot.phase === 'confirm' ? 'light' : appearance.theme}
                speed={active ? 1.2 : 0.85}
                paused={snapshot.phase === 'hidden' || snapshot.phase === 'error'}
                aria-hidden="true"
              />
            ) : (
              <Icon className="size-6" aria-hidden="true" />
            )}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5 text-start">
            <div className="flex items-center gap-1.5">
              <span
                className="truncate text-[0.68rem] font-medium tracking-wide text-muted-foreground"
                dir={detectTextDirection(snapshot.title)}
              >
                {snapshot.title}
              </span>
              <span
                className="flyover-status-dot size-1.5 shrink-0 rounded-full bg-muted-foreground"
                data-active={active}
                aria-hidden="true"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <FlyoverCopy
                text={snapshot.text}
                animate={snapshot.phase === 'listening' || snapshot.phase === 'reply'}
              />
              {showComposer ? (
                <FlyoverCompose
                  draft={draft}
                  onDraftChange={(text) => {
                    setDraft(text)
                    if (composing) window.flyoverApi.updateCompose(text)
                    else window.flyoverApi.startCompose(text)
                  }}
                  onSubmit={() => {
                    if (!draft.trim()) return
                    window.flyoverApi.submitCompose(draft)
                    setDraft('')
                  }}
                />
              ) : null}
            </div>
            {detailsOpen && snapshot.detail ? (
              <code
                className="flyover-detail block text-[0.62rem] text-muted-foreground"
                dir={detectTextDirection(snapshot.detail)}
              >
                {snapshot.detail}
              </code>
            ) : snapshot.hint ? (
              <p
                className="truncate text-[0.66rem] text-muted-foreground"
                dir={detectTextDirection(snapshot.hint)}
              >
                {snapshot.hint}
              </p>
            ) : null}
            {snapshot.phase === 'confirm' && snapshot.detail ? (
              <Button
                size="xs"
                variant="ghost"
                className="w-fit"
                aria-expanded={detailsOpen}
                onClick={() => setDetailsOpen((open) => !open)}
              >
                جزئیات
                <ChevronDown data-icon="inline-end" />
              </Button>
            ) : null}
          </div>
        </div>
        {snapshot.previewImage ? (
          <div className="flyover-preview overflow-hidden rounded-[1.05rem] border border-border/60 bg-black/35">
            <img
              src={snapshot.previewImage}
              alt="آنچه میکی از صفحه دید"
              className="block h-[7.5rem] w-full object-cover object-top"
            />
          </div>
        ) : null}
        {hasActions ? (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {snapshot.canFinish ? (
              <Button
                size="icon-sm"
                variant="secondary"
                onClick={window.flyoverApi.finishDictation}
              >
                <Square data-icon="inline-start" />
                <span className="sr-only">پایان دیکته</span>
              </Button>
            ) : null}
            {snapshot.canApprove ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.flyoverApi.resolveApproval(false)}
                >
                  <X data-icon="inline-start" />
                  نه
                </Button>
                <Button size="sm" onClick={() => window.flyoverApi.resolveApproval(true)}>
                  <Check data-icon="inline-start" />
                  انجام بده
                </Button>
              </>
            ) : null}
            {snapshot.canRespondToDisclosure ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.flyoverApi.resolveDisclosure(false)}
                >
                  نه
                </Button>
                <Button size="sm" onClick={() => window.flyoverApi.resolveDisclosure(true)}>
                  ادامه
                </Button>
              </>
            ) : null}
            {snapshot.canOpenModels ? (
              <>
                <Button size="sm" variant="ghost" onClick={window.flyoverApi.cancel}>
                  بعداً
                </Button>
                <Button size="sm" onClick={window.flyoverApi.openModels}>
                  <Download data-icon="inline-start" />
                  دانلود مدل
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  )
}
