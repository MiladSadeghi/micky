import { Check, ChevronDown, Download, Eye, Mic, MicOff, Sparkles, Square, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ThinkingOrb, type OrbState } from 'thinking-orbs'
import { INITIAL_FLYOVER_SNAPSHOT, type FlyoverSnapshot } from '@/lib/flyover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
  reply: 'composing',
  done: 'breathing',
  unavailable: 'breathing',
  error: 'shaping'
}

export function FlyoverApp(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<FlyoverSnapshot>(INITIAL_FLYOVER_SNAPSHOT)
  const [detailsOpen, setDetailsOpen] = useState(false)

  useEffect(() => {
    void window.flyoverApi.getSnapshot().then(setSnapshot)
    return window.flyoverApi.onSnapshotChange(setSnapshot)
  }, [])

  useEffect(() => {
    setDetailsOpen(false)
  }, [snapshot.detail, snapshot.phase])

  const Icon =
    snapshot.phase === 'unavailable'
      ? MicOff
      : snapshot.mode === 'screen'
        ? Eye
        : snapshot.phase === 'reply'
          ? Sparkles
          : Mic
  const active = ['listening', 'thinking', 'tool', 'cleaning', 'capturing', 'looking'].includes(
    snapshot.phase
  )
  return (
    <main className="flex h-full items-start justify-center p-2" dir="rtl">
      <section
        className="flyover-surface flex min-h-24 w-full items-center gap-3 rounded-[1.4rem] border border-border/70 bg-grey-950/95 px-3.5 py-3 shadow-2xl backdrop-blur-xl"
        aria-live="polite"
      >
        <span
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-full transition-colors',
            snapshot.phase === 'confirm' ? 'bg-foreground text-background' : 'bg-foreground/10'
          )}
        >
          {snapshot.mode === 'assistant' ? (
            <ThinkingOrb
              state={FLYOVER_ORB_STATE[snapshot.phase]}
              size={20}
              theme={snapshot.phase === 'confirm' ? 'light' : 'dark'}
              speed={active ? 1.2 : 0.85}
              paused={snapshot.phase === 'hidden' || snapshot.phase === 'error'}
              aria-hidden="true"
            />
          ) : (
            <Icon className="size-4" aria-hidden="true" />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-start">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[0.66rem] text-muted-foreground">{snapshot.title}</span>
            <span
              className="flyover-status-dot size-1 shrink-0 rounded-full bg-muted-foreground"
              data-active={active}
              aria-hidden="true"
            />
          </div>
          <p className="line-clamp-3 text-xs leading-5">{snapshot.text || '...'}</p>
          {detailsOpen && snapshot.detail ? (
            <code className="block truncate text-[0.58rem] text-muted-foreground" dir="ltr">
              {snapshot.detail}
            </code>
          ) : snapshot.hint ? (
            <p className="truncate text-[0.62rem] text-muted-foreground">{snapshot.hint}</p>
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
        <div className="flex shrink-0 items-center gap-1">
          {snapshot.canFinish ? (
            <Button size="icon-sm" variant="secondary" onClick={window.flyoverApi.finishDictation}>
              <Square data-icon="inline-start" />
              <span className="sr-only">پایان دیکته</span>
            </Button>
          ) : null}
          {snapshot.canApprove ? (
            <div className="flex flex-col gap-1">
              <Button size="sm" onClick={() => window.flyoverApi.resolveApproval(true)}>
                <Check data-icon="inline-start" />
                انجام بده
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => window.flyoverApi.resolveApproval(false)}
              >
                <X data-icon="inline-start" />
                نه
              </Button>
            </div>
          ) : null}
          {snapshot.canRespondToDisclosure ? (
            <>
              <Button size="sm" onClick={() => window.flyoverApi.resolveDisclosure(true)}>
                ادامه
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => window.flyoverApi.resolveDisclosure(false)}
              >
                نه
              </Button>
            </>
          ) : null}
          {snapshot.canOpenModels ? (
            <div className="flex flex-col gap-1">
              <Button size="sm" onClick={window.flyoverApi.openModels}>
                <Download data-icon="inline-start" />
                دانلود مدل
              </Button>
              <Button size="sm" variant="ghost" onClick={window.flyoverApi.cancel}>
                بعداً
              </Button>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}
