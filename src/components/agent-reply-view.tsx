import { Check, ChevronDown, LoaderCircle, ShieldCheck, Terminal, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { agentStatusLabel, agentToolLabel } from '@/lib/agent'

type AgentReplyViewProps = {
  turnId: string
  text: string
  phase: string
  toolName?: string | null
  confirmText?: string | null
  confirmDetail?: string | null
  dimmed?: boolean
  onApprove?: () => void
  onDeny?: () => void
}

function splitWords(text: string): string[] {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/) : []
}

function ReplyWord({ word, delayIndex }: { word: string; delayIndex: number }): React.JSX.Element {
  const [delay] = useState(delayIndex)
  return (
    <span
      className="transcript-word transcript-word-enter"
      style={{ '--word-index': delay } as React.CSSProperties}
    >
      {word}
    </span>
  )
}

function ApprovalCard({
  purpose,
  detail,
  onApprove,
  onDeny
}: {
  purpose: string
  detail: string | null
  onApprove?: () => void
  onDeny?: () => void
}): React.JSX.Element {
  const [revealed, setRevealed] = useState(false)

  return (
    <section className="approval-card" aria-labelledby="approval-title">
      <div className="approval-heading">
        <span className="approval-icon" aria-hidden="true">
          <ShieldCheck />
        </span>
        <div className="min-w-0 text-start">
          <span className="approval-kicker">نیاز به اجازه</span>
          <p id="approval-title" className="approval-purpose">
            {purpose}
          </p>
        </div>
      </div>

      <p className="approval-hint">فقط با اجازه تو اجرا می‌شه.</p>

      <div className="flex w-full gap-2" dir="rtl">
        <Button className="flex-1" onClick={onApprove} disabled={!onApprove}>
          <Check data-icon="inline-start" />
          انجامش بده
        </Button>
        <Button variant="secondary" className="flex-1" onClick={onDeny} disabled={!onDeny}>
          <X data-icon="inline-start" />
          نه، بی‌خیال
        </Button>
      </div>

      {detail ? (
        <>
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            onClick={() => setRevealed((open) => !open)}
            aria-expanded={revealed}
          >
            <Terminal data-icon="inline-start" />
            {revealed ? 'بستن جزئیات' : 'دیدن دستور'}
            <ChevronDown data-icon="inline-end" className={revealed ? 'rotate-180' : undefined} />
          </Button>
          {revealed ? <pre className="tool-confirm-detail">{detail}</pre> : null}
        </>
      ) : null}
    </section>
  )
}

function AnimatedReply({
  turnId,
  words,
  phase,
  dimmed
}: {
  turnId: string
  words: string[]
  phase: string
  dimmed: boolean
}): React.JSX.Element {
  const previous = useRef({ turnId, count: 0 })
  const enterFrom = previous.current.turnId === turnId ? previous.current.count : 0

  useEffect(() => {
    previous.current = { turnId, count: words.length }
  }, [turnId, words.length])

  return (
    <p
      className="transcript agent-reply"
      data-final={phase === 'idle' || phase === 'error' ? 'true' : 'false'}
      data-followup={dimmed ? 'true' : 'false'}
    >
      {words.map((word, index) => (
        <ReplyWord
          key={`${turnId}-${index}`}
          word={word}
          delayIndex={Math.max(0, index - enterFrom)}
        />
      ))}
    </p>
  )
}

export function AgentReplyView({
  turnId,
  text,
  phase,
  toolName = null,
  confirmText = null,
  confirmDetail = null,
  dimmed = false,
  onApprove,
  onDeny
}: AgentReplyViewProps): React.JSX.Element {
  if (phase === 'confirm') {
    return (
      <ApprovalCard
        key={`${turnId}-${confirmDetail ?? ''}`}
        purpose={confirmText?.trim() || 'این کار رو انجام بدم؟'}
        detail={confirmDetail}
        onApprove={onApprove}
        onDeny={onDeny}
      />
    )
  }

  if (phase === 'tool') {
    return (
      <section className="tool-activity" role="status" aria-live="polite">
        <LoaderCircle className="tool-activity-spinner" aria-hidden="true" />
        <div className="min-w-0 text-start">
          <p className="tool-activity-name">{agentToolLabel(toolName)}</p>
          <p className="tool-activity-status">{agentStatusLabel(phase, toolName)}</p>
        </div>
      </section>
    )
  }

  const words = splitWords(text)
  if (words.length === 0) {
    return (
      <span className="transcript-placeholder text-muted-foreground">
        {agentStatusLabel(phase, toolName)}
      </span>
    )
  }

  return <AnimatedReply turnId={turnId} words={words} phase={phase} dimmed={dimmed} />
}
