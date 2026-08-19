import { useState } from 'react'

type TranscriptViewProps = {
  sessionId: string
  text: string
  isFinal: boolean
}

function splitWords(text: string): string[] {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/) : []
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
  const words = splitWords(text)
  const [meta, setMeta] = useState({ sessionId, count: 0 })

  let enterFrom = meta.count
  if (meta.sessionId !== sessionId) {
    enterFrom = 0
    setMeta({ sessionId, count: words.length })
  } else if (meta.count !== words.length) {
    setMeta({ sessionId, count: words.length })
  }

  if (words.length === 0) {
    return <span className="transcript-placeholder">…</span>
  }

  return (
    <p className="transcript" data-final={isFinal ? 'true' : 'false'}>
      {words.map((word, index) => (
        <TranscriptWord
          key={`${sessionId}-${index}`}
          word={word}
          delayIndex={Math.max(0, index - enterFrom)}
        />
      ))}
    </p>
  )
}
