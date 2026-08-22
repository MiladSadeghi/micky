export const LIVE_TRANSCRIPT_WORD_LIMIT = 28

export type TranscriptWindow = {
  words: string[]
  startIndex: number
  totalWords: number
  truncated: boolean
}

export function transcriptWindow(
  text: string,
  limit = LIVE_TRANSCRIPT_WORD_LIMIT
): TranscriptWindow {
  const trimmed = text.trim()
  const words = trimmed ? trimmed.split(/\s+/) : []
  const safeLimit = Math.max(1, Math.floor(limit))
  const startIndex = Math.max(0, words.length - safeLimit)

  return {
    words: words.slice(startIndex),
    startIndex,
    totalWords: words.length,
    truncated: startIndex > 0
  }
}
