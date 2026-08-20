export type ApprovalVerdict = 'yes' | 'no' | 'unknown'

const YES_TOKENS = [
  'آره',
  'اره',
  'باشه',
  'بله',
  'اوکی',
  'okay',
  'ok',
  'بزن',
  'انجام بده',
  'حتما',
  'yes'
]

const NO_TOKENS = ['نه', 'نکن', 'ولش کن', 'ولشکن', 'بی‌خیال', 'بیخیال', 'کنسل', 'cancel', 'no']

export function interpretApproval(text: string): ApprovalVerdict {
  const normalized = normalizeUtterance(text)
  if (!normalized) return 'unknown'
  const hasNo = NO_TOKENS.some((token) => includesToken(normalized, normalizeUtterance(token)))
  if (hasNo) return 'no'
  const hasYes = YES_TOKENS.some((token) => includesToken(normalized, normalizeUtterance(token)))
  return hasYes ? 'yes' : 'unknown'
}

function includesToken(haystack: string, token: string): boolean {
  if (!token) return false
  if (/^[a-z0-9]+$/.test(token)) {
    return new RegExp(`(?:^|\\s)${token}(?:$|\\s)`).test(haystack)
  }
  return haystack.includes(token)
}

function normalizeUtterance(value: string): string {
  return value
    .toLowerCase()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
