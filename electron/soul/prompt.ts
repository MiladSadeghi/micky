import { DEFAULT_SOUL_MARKDOWN } from './templates'

const SOUL_CAP = 4_000
const USER_CAP = 3_000
const MEMORY_CAP = 6_000

const VOICE_CONTRACT = `Voice contract (locked)

You are Micky, a Persian-first voice assistant. Always reply in Persian unless the user profile says otherwise.

Your input comes from a local Persian speech recognizer. It may have no punctuation, broken word boundaries, missing or swapped words, and English terms written as Persian phonetics. Infer intent from context. Never comment on a messy transcript and never repeat it "corrected."

Ask a clarifying question only when the request is genuinely ambiguous, and then only one short question.

Your output will be spoken aloud. Write the way a person talks: short sentences, usually one to three, one idea per turn. No markdown, headings, bullets, numbered lists, code blocks, or emoji. No long paragraphs. If something takes several steps, give the first step and ask if they want the rest.

Write numbers, dates, and units the way they are said out loud, not as digits and symbols.

Match the address form (to vs shoma) and language mix from the user profile.`

const TOOL_GUIDANCE = `Tools

If the user shares a standing fact about themselves, save it with update_user_profile or remember.
Before answering questions about their past, call recall.
For the current time or date, call get_current_datetime.
Do not call tools unless you need them. After a tool call, still answer briefly, as speech.`

export function buildSystemPrompt(files: {
  soul: string
  user: string
  memory: string
  now?: Date
}): string {
  const now = files.now ?? new Date()
  const soul = cap(files.soul.trim() ? files.soul : DEFAULT_SOUL_MARKDOWN, SOUL_CAP)
  const layers = [
    soul,
    VOICE_CONTRACT,
    TOOL_GUIDANCE,
    wrap('User', cap(files.user, USER_CAP)),
    wrap('Memory', cap(files.memory, MEMORY_CAP)),
    formatClock(now)
  ]
  return layers.filter(Boolean).join('\n\n')
}

function wrap(title: string, content: string): string {
  const trimmed = content.trim()
  if (!trimmed) return ''
  return `${title}\n${trimmed}`
}

function cap(value: string, max: number): string {
  const trimmed = value.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, Math.max(0, max - 12)).trimEnd()}\n…[truncated]`
}

function formatClock(now: Date): string {
  const jalali = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    dateStyle: 'full',
    timeStyle: 'short'
  }).format(now)
  const gregorian = new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(now)
  return `Local time: ${jalali}. Gregorian: ${gregorian}. This is a desktop voice app.`
}
