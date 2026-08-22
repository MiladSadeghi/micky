import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { SOUL_FILE_NAMES, type SoulFileId, type UserProfileDraft } from '@/lib/soul'
import {
  DEFAULT_MEMORY_MARKDOWN,
  DEFAULT_SOUL_MARKDOWN,
  DEFAULT_USER_MARKDOWN,
  USER_FIELD_LABELS
} from './templates'

const SEEDS: Record<SoulFileId, string> = {
  soul: DEFAULT_SOUL_MARKDOWN,
  user: DEFAULT_USER_MARKDOWN,
  memory: DEFAULT_MEMORY_MARKDOWN
}

const USER_FIELD_KEYS = Object.keys(USER_FIELD_LABELS) as Array<keyof typeof USER_FIELD_LABELS>
const LEGACY_USER_FIELD_LABELS: Record<keyof typeof USER_FIELD_LABELS, string> = {
  name: 'نام',
  about: 'درباره',
  personalityProfile: 'سبک شخصیت',
  addressForm: 'خطاب',
  languageMix: 'زبان',
  city: 'شهر',
  work: 'کار',
  focus: 'تمرکز',
  replyLength: 'طول پاسخ'
}

export class SoulStore {
  #root: string

  constructor(userDataPath: string) {
    this.#root = join(userDataPath, 'soul')
  }

  async initialize(): Promise<void> {
    await mkdir(this.#root, { recursive: true })
    for (const id of Object.keys(SEEDS) as SoulFileId[]) {
      const path = this.#pathFor(id)
      let current: string
      try {
        current = await readFile(path, 'utf8')
      } catch {
        await this.#persist(path, SEEDS[id])
        continue
      }
      const migrated = migrateLegacyMarkdown(id, current)
      if (migrated !== normalizeMarkdown(current)) await this.#persist(path, migrated)
    }
  }

  async read(id: SoulFileId): Promise<string> {
    try {
      return await readFile(this.#pathFor(id), 'utf8')
    } catch {
      return SEEDS[id]
    }
  }

  async write(id: SoulFileId, content: string): Promise<string> {
    const normalized = normalizeMarkdown(content)
    await this.#persist(this.#pathFor(id), normalized)
    return normalized
  }

  async readAll(): Promise<Record<SoulFileId, string>> {
    const [soul, user, memory] = await Promise.all([
      this.read('soul'),
      this.read('user'),
      this.read('memory')
    ])
    return { soul, user, memory }
  }

  async appendMemory(fact: string): Promise<string> {
    const trimmed = fact.trim()
    if (!trimmed) return this.read('memory')
    const current = (await this.read('memory')).trimEnd()
    const stamp = formatMemoryStamp(new Date())
    const line = `- ${trimmed} (${stamp})`
    return this.write('memory', `${current}\n${line}\n`)
  }

  async patchUser(field: string, value: string): Promise<string> {
    const key = USER_FIELD_KEYS.find((candidate) => candidate === field)
    if (!key) throw new Error(`Unknown user field: ${field}`)
    const current = await this.read('user')
    const nextValue = formatUserFieldValue(key, value)
    const label = USER_FIELD_LABELS[key]
    const legacyLabel = LEGACY_USER_FIELD_LABELS[key]
    const pattern = new RegExp(
      `^- (?:${escapeRegExp(label)}|${escapeRegExp(legacyLabel)}):.*$`,
      'm'
    )
    const line = `- ${label}: ${nextValue}`
    const next = pattern.test(current)
      ? current.replace(pattern, line)
      : `${current.trimEnd()}\n${line}\n`
    return this.write('user', next)
  }

  async writeUserProfile(draft: UserProfileDraft): Promise<string> {
    return this.write('user', formatUserMarkdown(draft))
  }

  #pathFor(id: SoulFileId): string {
    return join(this.#root, SOUL_FILE_NAMES[id])
  }

  async #persist(path: string, content: string): Promise<void> {
    await mkdir(this.#root, { recursive: true })
    const tempPath = `${path}.tmp`
    await writeFile(tempPath, content, 'utf8')
    await rename(tempPath, path)
  }
}

export function formatUserMarkdown(draft: UserProfileDraft): string {
  const lines = [
    '# User Profile',
    '',
    `- ${USER_FIELD_LABELS.name}: ${draft.name.trim() || 'Unknown'}`,
    `- ${USER_FIELD_LABELS.about}: ${formatPlainText(draft.about)}`,
    `- ${USER_FIELD_LABELS.personalityProfile}: ${formatPersonalityProfile(draft.personalityProfile)}`,
    `- ${USER_FIELD_LABELS.addressForm}: ${formatAddressForm(draft.addressForm)}`,
    `- ${USER_FIELD_LABELS.languageMix}: ${formatLanguageMix(draft.languageMix)}`,
    `- ${USER_FIELD_LABELS.city}: ${draft.city.trim() || 'Unknown'}`,
    `- ${USER_FIELD_LABELS.work}: ${draft.work.trim() || 'Unknown'}`,
    `- ${USER_FIELD_LABELS.focus}: ${draft.focus.trim() || 'Unknown'}`,
    `- ${USER_FIELD_LABELS.replyLength}: ${formatReplyLength(draft.replyLength)}`,
    ''
  ]
  return lines.join('\n')
}

function formatUserFieldValue(field: keyof typeof USER_FIELD_LABELS, value: string): string {
  const trimmed = value.trim()
  if (field === 'personalityProfile') {
    if (trimmed === 'direct') return formatPersonalityProfile('direct')
    if (trimmed === 'thoughtful') return formatPersonalityProfile('thoughtful')
    if (trimmed === 'playful') return formatPersonalityProfile('playful')
    return formatPersonalityProfile('balanced')
  }
  if (field === 'addressForm') {
    return formatAddressForm(trimmed === 'شما' || trimmed === 'shoma' ? 'shoma' : 'to')
  }
  if (field === 'languageMix') {
    return formatLanguageMix(trimmed === 'persian' || trimmed === 'فارسی' ? 'persian' : 'mixed')
  }
  if (field === 'replyLength') {
    return formatReplyLength(trimmed === 'medium' || trimmed === 'متوسط' ? 'medium' : 'short')
  }
  return formatPlainText(trimmed)
}

function formatPlainText(value: string): string {
  return value.replace(/\s+/g, ' ').trim() || 'Unknown'
}

function formatPersonalityProfile(value: UserProfileDraft['personalityProfile']): string {
  if (value === 'direct') return 'direct operator — decisive, practical, and no fluff'
  if (value === 'thoughtful')
    return 'curious thinking partner — reflective, exploratory, and asks useful questions'
  if (value === 'playful') return 'playful companion — light, witty, and energetic'
  return 'balanced companion — warm, clear, and practical'
}

function formatAddressForm(value: UserProfileDraft['addressForm']): string {
  return value === 'shoma' ? 'formal shoma' : 'informal to'
}

function formatLanguageMix(value: UserProfileDraft['languageMix']): string {
  return value === 'persian' ? 'Persian only' : 'Persian with English terms when useful'
}

function formatReplyLength(value: UserProfileDraft['replyLength']): string {
  return value === 'medium' ? 'a little more detailed' : 'very short'
}

function formatMemoryStamp(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date)
}

function migrateLegacyMarkdown(id: SoulFileId, content: string): string {
  let next = normalizeMarkdown(content)
  if (id === 'user') {
    if (next === normalizeMarkdown('# کاربر\n\nهنوز چیزی از صاحب این دستگاه ثبت نشده.\n')) {
      return normalizeMarkdown(DEFAULT_USER_MARKDOWN)
    }
    next = next.replace(/^# کاربر\s*$/m, '# User Profile')
    for (const key of USER_FIELD_KEYS) {
      const legacy = LEGACY_USER_FIELD_LABELS[key]
      const label = USER_FIELD_LABELS[key]
      next = next.replace(new RegExp(`^- ${escapeRegExp(legacy)}:`, 'm'), `- ${label}:`)
    }
    next = next
      .replace(/:\s*نامشخص\s*$/gm, ': Unknown')
      .replace(/:\s*شما \(رسمی\)\s*$/gm, ': formal shoma')
      .replace(/:\s*تو \(خودمانی\)\s*$/gm, ': informal to')
      .replace(/:\s*فقط فارسی\s*$/gm, ': Persian only')
      .replace(
        /:\s*فارسی با اصطلاحات انگلیسی وقتی لازم است\s*$/gm,
        ': Persian with English terms when useful'
      )
      .replace(/:\s*کمی مفصل‌تر\s*$/gm, ': a little more detailed')
      .replace(/:\s*خیلی کوتاه\s*$/gm, ': very short')
  }
  if (id === 'memory') {
    if (
      next ===
      normalizeMarkdown('# حافظه\n\nحقایقی که میکی در طول گفتگو یاد گرفته، هر خط یک نکته پایدار.\n')
    ) {
      return normalizeMarkdown(DEFAULT_MEMORY_MARKDOWN)
    }
    next = next
      .replace(/^# حافظه\s*$/m, '# Long-term Memory')
      .replace(
        /^حقایقی که میکی در طول گفتگو یاد گرفته، هر خط یک نکته پایدار\.\s*$/m,
        'Durable facts Micky learns over time. Keep one stable fact per bullet.'
      )
  }
  return normalizeMarkdown(next)
}

function normalizeMarkdown(content: string): string {
  return content.replace(/\r\n/g, '\n').trimEnd() + '\n'
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
