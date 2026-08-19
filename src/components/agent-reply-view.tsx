import { useState } from 'react'

type AgentReplyViewProps = {
  turnId: string
  text: string
  phase: string
  awaitingFollowup?: boolean
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

export function AgentReplyView({
  turnId,
  text,
  phase,
  awaitingFollowup = false
}: AgentReplyViewProps): React.JSX.Element {
  const words = splitWords(text)
  const [meta, setMeta] = useState({ turnId, count: 0 })

  let enterFrom = meta.count
  if (meta.turnId !== turnId) {
    enterFrom = 0
    setMeta({ turnId, count: words.length })
  } else if (meta.count !== words.length) {
    setMeta({ turnId, count: words.length })
  }

  if (words.length === 0) {
    const placeholder =
      phase === 'tool'
        ? 'یک لحظه، دارم یادداشت می‌کنم…'
        : phase === 'error'
          ? '…'
          : 'دارم فکر می‌کنم…'
    return <span className="transcript-placeholder text-muted-foreground">{placeholder}</span>
  }

  return (
    <p
      className="transcript agent-reply"
      data-final={phase === 'idle' || phase === 'error' ? 'true' : 'false'}
      data-followup={awaitingFollowup ? 'true' : 'false'}
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
