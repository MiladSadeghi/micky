const CATCH_UP_DIVISOR = 12

export function advanceReveal(shown: string, target: string): string {
  if (shown === target) return target
  const shownChars = [...shown]
  const targetChars = [...target]
  let shared = 0
  while (
    shared < shownChars.length &&
    shared < targetChars.length &&
    shownChars[shared] === targetChars[shared]
  ) {
    shared += 1
  }
  const remaining = targetChars.length - shared
  if (remaining <= 0) return target
  const step = Math.max(1, Math.ceil(remaining / CATCH_UP_DIVISOR))
  return targetChars.slice(0, shared + step).join('')
}
