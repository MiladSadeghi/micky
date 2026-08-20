const SCREEN_TERMS = [
  'صفحه',
  'اسکرین',
  'مانیتور',
  'چیزی که می‌بینم',
  'جلوی من',
  'روی صفحه',
  'screen',
  'screenshot',
  'what do you see',
  'look at'
]

const LOOK_TERMS = [
  'نگاه',
  'ببین',
  'می‌بینی',
  'توضیح',
  'بگو',
  'چیه',
  'چی هست',
  'explain',
  'describe'
]

const DIRECT_VISUAL_REQUESTS = [
  'چی میبینی',
  'چی می بینی',
  'چه چیزی میبینی',
  'چه چیزی می بینی',
  'what do you see',
  'what can you see',
  'can you see this',
  'look at this'
]

export function hasExplicitScreenIntent(text: string): boolean {
  const normalized = normalize(text)
  return (
    DIRECT_VISUAL_REQUESTS.some((term) => normalized.includes(normalize(term))) ||
    (SCREEN_TERMS.some((term) => normalized.includes(normalize(term))) &&
      LOOK_TERMS.some((term) => normalized.includes(normalize(term))))
  )
}

function normalize(text: string): string {
  return text
    .toLocaleLowerCase('fa-IR')
    .replaceAll('\u200c', '')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\s+/g, ' ')
    .trim()
}
