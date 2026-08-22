export type FlyoverLayout = 'compact' | 'expanded' | 'reading'

export const FLYOVER_WINDOW_SIZES: Record<
  FlyoverLayout,
  { readonly width: number; readonly height: number }
> = {
  compact: { width: 420, height: 400 },
  expanded: { width: 560, height: 520 },
  reading: { width: 680, height: 640 }
}

export function getFlyoverLayout(text: string): FlyoverLayout {
  const length = Array.from(text.trim()).length
  if (length > 460) return 'reading'
  if (length > 180) return 'expanded'
  return 'compact'
}
