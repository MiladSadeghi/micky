export type AsrGlossaryEntry = {
  canonical: string
  variants: readonly string[]
}

// Shenava is a Persian CTC model. English product and developer terms are
// therefore commonly emitted as Persian phonetics, sometimes with broken word
// boundaries. Keep this list deliberately narrow: every variant should be a
// high-confidence spelling of the canonical term, not a fuzzy approximation.
export const ASR_GLOSSARY: readonly AsrGlossaryEntry[] = [
  { canonical: 'desktop', variants: ['دسکتاپ', 'دسک تاپ', 'دستکاپ', 'دستکتاپ'] },
  {
    canonical: 'ChatGPT',
    variants: ['چت جی پی تی', 'چت جی پی دی', 'چت جی بی تی', 'چت جی‌پی‌تی']
  },
  { canonical: 'OpenAI', variants: ['اوپن ای آی', 'اپن ای آی', 'اوپن ای‌آی'] },
  { canonical: 'OpenRouter', variants: ['اوپن روتر', 'اپن روتر', 'اوپن راتر'] },
  { canonical: 'Codex', variants: ['کدکس', 'کودکس', 'کادکس'] },
  { canonical: 'Gemini', variants: ['جمنای', 'جمینای', 'جمنی'] },
  { canonical: 'Perplexity AI', variants: ['پرپلکسیتی ای آی'] },
  { canonical: 'Perplexity', variants: ['پرپلکسیتی'] },
  { canonical: 'GitHub', variants: ['گیت هاب', 'گیت‌هاب', 'گیتهاب', 'گیت هب'] },
  { canonical: 'GitLab', variants: ['گیت لب', 'گیت‌لب', 'گیتلب'] },
  { canonical: 'VS Code', variants: ['وی اس کد', 'وی اس کود', 'وی‌اس‌کد'] },
  { canonical: 'Cursor', variants: ['کرسر', 'کورسر'] },
  { canonical: 'Xcode', variants: ['اکس کد', 'اکس کود', 'اکس‌کد'] },
  { canonical: 'macOS', variants: ['مک او اس', 'مک اواس', 'مک‌او‌اس'] },
  { canonical: 'Windows', variants: ['ویندوز'] },
  { canonical: 'Terminal', variants: ['ترمینال'] },
  { canonical: 'Finder', variants: ['فایندر'] },
  { canonical: 'Spotlight', variants: ['اسپات لایت', 'اسپات‌لایت', 'اسپاتلایت'] },
  { canonical: 'Chrome', variants: ['کروم', 'گوگل کروم'] },
  { canonical: 'Safari', variants: ['سافاری'] },
  { canonical: 'Firefox', variants: ['فایرفاکس', 'فایر فاکس'] },
  { canonical: 'Figma', variants: ['فیگما', 'فیگمه'] },
  { canonical: 'Notion AI', variants: ['نوشن ای آی'] },
  { canonical: 'Notion', variants: ['نوشن'] },
  { canonical: 'Slack', variants: ['اسلک'] },
  { canonical: 'Discord', variants: ['دیسکورد', 'دیس کورد'] },
  { canonical: 'Telegram', variants: ['تلگرام'] },
  { canonical: 'WhatsApp', variants: ['واتساپ', 'واتس اپ'] },
  { canonical: 'Spotify', variants: ['اسپاتیفای', 'اسپاتی فای'] },
  { canonical: 'Docker', variants: ['داکر', 'داکِر'] },
  { canonical: 'Kubernetes', variants: ['کوبرنتیز', 'کوبِرنتیز', 'کوبرنتس'] },
  { canonical: 'Vercel', variants: ['ورسل', 'ورسِل'] },
  { canonical: 'Cloudflare', variants: ['کلادفلر', 'کلاد فلر'] },
  { canonical: 'React', variants: ['ری اکت', 'ری‌اکت', 'ریاکت'] },
  { canonical: 'Next.js', variants: ['نکست جی اس', 'نکست‌جی‌اس'] },
  { canonical: 'Node.js', variants: ['نود جی اس', 'نود‌جی‌اس'] },
  { canonical: 'TypeScript', variants: ['تایپ اسکریپت', 'تایپ‌اسکریپت'] },
  { canonical: 'JavaScript', variants: ['جاوا اسکریپت', 'جاوا‌اسکریپت'] },
  { canonical: 'Python', variants: ['پایتون'] },
  { canonical: 'Rust', variants: ['رست'] },
  { canonical: 'Electron', variants: ['الکترون'] },
  { canonical: 'Tailwind', variants: ['تیلویند', 'تیل ویند'] },
  { canonical: 'shadcn', variants: ['شد سی ان', 'شَد سی ان', 'شَدسی‌اِن'] },
  { canonical: 'PostgreSQL', variants: ['پستگرس', 'پستگر اس کیو ال', 'پستگرس کیو ال'] },
  { canonical: 'SQLite', variants: ['اس کیو لایت', 'اس‌کیو‌لایت'] },
  { canonical: 'AI', variants: ['ای آی', 'ای‌آی'] },
  { canonical: 'AGI', variants: ['ای جی آی', 'ای‌جی‌آی'] },
  { canonical: 'LLM', variants: ['ال ال ام', 'اِل اِل اِم'] },
  { canonical: 'API', variants: ['ای پی آی', 'ای‌پی‌آی'] },
  { canonical: 'MCP', variants: ['ام سی پی', 'اِم سی پی'] },
  { canonical: 'RAG', variants: ['آر ای جی', 'آر‌ای‌جی'] },
  { canonical: 'GPU', variants: ['جی پی یو', 'جی‌پی‌یو'] },
  { canonical: 'CPU', variants: ['سی پی یو', 'سی‌پی‌یو'] },
  { canonical: 'prompt', variants: ['پرامپت', 'پرومپت'] },
  { canonical: 'token', variants: ['توکن'] },
  { canonical: 'context', variants: ['کانتکست', 'کانتکس'] },
  { canonical: 'embedding', variants: ['امبدینگ', 'امبدینک'] },
  { canonical: 'AI agent', variants: ['ایجنت هوش مصنوعی'] },
  { canonical: 'agent', variants: ['ایجنت'] },
  { canonical: 'workflow', variants: ['ورک فلو', 'ورک‌فلو'] },
  { canonical: 'repository', variants: ['ریپازیتوری'] },
  { canonical: 'repo', variants: ['ریپو'] },
  { canonical: 'commit', variants: ['کامیت'] },
  { canonical: 'pull request', variants: ['پول ریکوئست', 'پول‌ریکوئست'] },
  { canonical: 'frontend', variants: ['فرانت اند', 'فرانت‌اند'] },
  { canonical: 'backend', variants: ['بک اند', 'بک‌اند'] },
  { canonical: 'میکی', variants: ['میککی'] },
  { canonical: 'شنوا', variants: ['شن آوا', 'شن‌آوا'] }
]

const WORD_CHARACTER = '[\\p{L}\\p{N}_]'
const PHRASE_SEPARATOR = '[\\s\\u200c]+'

type CompiledGlossaryEntry = {
  canonical: string
  pattern: RegExp
}

const COMPILED_GLOSSARY = ASR_GLOSSARY.map(compileEntry).sort(
  (left, right) => right.pattern.source.length - left.pattern.source.length
)

export function normalizeAsrOrthography(input: string): string {
  return input
    .normalize('NFKC')
    .replace(/[يىۍې]/gu, 'ی')
    .replace(/ك/gu, 'ک')
    .replace(/[أإ]/gu, 'ا')
    .replace(/ۀ/gu, 'هٔ')
    .replace(/ـ/gu, '')
    .replace(/[\u064b-\u065f\u0670]/gu, '')
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu, '')
    .replace(/[\t\n\r\f\v\u00a0 ]+/gu, ' ')
    .replace(/\u200c{2,}/gu, '\u200c')
    .trim()
}

export function normalizeAsrTranscript(input: string): string {
  let text = normalizeAsrOrthography(input)
  for (const entry of COMPILED_GLOSSARY) {
    text = text.replace(entry.pattern, entry.canonical)
  }
  return text
}

function compileEntry(entry: AsrGlossaryEntry): CompiledGlossaryEntry {
  const variants = [entry.canonical, ...entry.variants]
    .map(normalizeAsrOrthography)
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
  const alternatives = [...new Set(variants.map(phraseToPattern))]
  return {
    canonical: entry.canonical,
    pattern: new RegExp(
      `(?<!${WORD_CHARACTER})(?:${alternatives.join('|')})(?!${WORD_CHARACTER})`,
      'giu'
    )
  }
}

function phraseToPattern(phrase: string): string {
  return phrase
    .split(/[\s\u200c]+/u)
    .map(escapeRegExp)
    .join(PHRASE_SEPARATOR)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
