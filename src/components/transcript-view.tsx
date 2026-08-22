import { useEffect, useRef, useState } from 'react'
import { transcriptWindow } from '@/lib/transcript-window'

type TranscriptViewProps = {
  sessionId: string
  text: string
  isFinal: boolean
}

function TranscriptWord({
  word,
  delayIndex
}: {
  word: string
  delayIndex: number
}): React.JSX.Element {
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

export function TranscriptView({
  sessionId,
  text,
  isFinal
}: TranscriptViewProps): React.JSX.Element {
  const window = transcriptWindow(text)
  const previous = useRef({ sessionId, count: 0 })
  const enterFrom = previous.current.sessionId === sessionId ? previous.current.count : 0

  useEffect(() => {
    previous.current = { sessionId, count: window.totalWords }
  }, [sessionId, window.totalWords])

  if (window.totalWords === 0) {
    return <span className="transcript-placeholder">…</span>
  }

  return (
    <p
      className="transcript transcript-window"
      data-final={isFinal ? 'true' : 'false'}
      data-truncated={window.truncated ? 'true' : 'false'}
    >
      {window.truncated ? (
        <span className="transcript-window-ellipsis" aria-hidden="true">
          …
        </span>
      ) : null}
      {window.words.map((word, index) => {
        const absoluteIndex = window.startIndex + index
        return (
          <TranscriptWord
            key={`${sessionId}-${absoluteIndex}`}
            word={word}
            delayIndex={Math.max(0, absoluteIndex - enterFrom)}
          />
        )
      })}
    </p>
  )
}
