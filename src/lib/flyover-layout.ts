export type FlyoverLayout = 'compact' | 'expanded' | 'reading' | 'wide' | 'wide-reading'

export const FLYOVER_WINDOW_SIZES: Record<
  FlyoverLayout,
  { readonly width: number; readonly height: number }
> = {
  compact: { width: 420, height: 400 },
  expanded: { width: 560, height: 520 },
  reading: { width: 680, height: 640 },
  wide: { width: 760, height: 560 },
  'wide-reading': { width: 820, height: 720 }
}

export function getFlyoverLayout(text: string): FlyoverLayout {
  const trimmed = text.trim()
  const length = Array.from(trimmed).length
  const meaningfulLines = trimmed.split(/\r?\n/u).filter((line) => line.trim())
  const structuredLines = meaningfulLines.filter((line) =>
    /^\s*(?:#{1,6}\s|>\s|[-+*]\s|\d+[.)]\s)/u.test(line)
  ).length
  const needsWideLayout =
    /(?:^|\n)\s*(?:```|~~~)/u.test(trimmed) ||
    meaningfulLines.some((line) =>
      /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/u.test(line)
    )

  if (needsWideLayout) {
    if (length > 420 || meaningfulLines.length > 8) return 'wide-reading'
    return 'wide'
  }
  if (length > 460) return 'reading'
  if (meaningfulLines.length > 10) return 'reading'
  if (length > 180 || meaningfulLines.length > 5 || structuredLines >= 3) return 'expanded'
  return 'compact'
}
