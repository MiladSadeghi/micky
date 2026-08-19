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

export class SoulStore {
  #root: string

  constructor(userDataPath: string) {
    this.#root = join(userDataPath, 'soul')
  }

  async initialize(): Promise<void> {
    await mkdir(this.#root, { recursive: true })
    for (const id of Object.keys(SEEDS) as SoulFileId[]) {
      const path = this.#pathFor(id)
      try {
        await readFile(path, 'utf8')
      } catch {
        await this.#persist(path, SEEDS[id])
      }
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
    const pattern = new RegExp(`^- ${escapeRegExp(label)}:.*$`, 'm')
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
    '# کاربر',
    '',
    `- ${USER_FIELD_LABELS.name}: ${draft.name.trim() || 'نامشخص'}`,
    `- ${USER_FIELD_LABELS.addressForm}: ${formatAddressForm(draft.addressForm)}`,
    `- ${USER_FIELD_LABELS.languageMix}: ${formatLanguageMix(draft.languageMix)}`,
    `- ${USER_FIELD_LABELS.city}: ${draft.city.trim() || 'نامشخص'}`,
    `- ${USER_FIELD_LABELS.work}: ${draft.work.trim() || 'نامشخص'}`,
    `- ${USER_FIELD_LABELS.focus}: ${draft.focus.trim() || 'نامشخص'}`,
    `- ${USER_FIELD_LABELS.replyLength}: ${formatReplyLength(draft.replyLength)}`,
    ''
  ]
  return lines.join('\n')
}

function formatUserFieldValue(field: keyof typeof USER_FIELD_LABELS, value: string): string {
  const trimmed = value.trim()
  if (field === 'addressForm') {
    return formatAddressForm(trimmed === 'شما' || trimmed === 'shoma' ? 'shoma' : 'to')
  }
  if (field === 'languageMix') {
    return formatLanguageMix(trimmed === 'persian' || trimmed === 'فارسی' ? 'persian' : 'mixed')
  }
  if (field === 'replyLength') {
    return formatReplyLength(trimmed === 'medium' || trimmed === 'متوسط' ? 'medium' : 'short')
  }
  return trimmed || 'نامشخص'
}

function formatAddressForm(value: UserProfileDraft['addressForm']): string {
  return value === 'shoma' ? 'شما (رسمی)' : 'تو (خودمانی)'
}

function formatLanguageMix(value: UserProfileDraft['languageMix']): string {
  return value === 'persian' ? 'فقط فارسی' : 'فارسی با اصطلاحات انگلیسی وقتی لازم است'
}

function formatReplyLength(value: UserProfileDraft['replyLength']): string {
  return value === 'medium' ? 'کمی مفصل‌تر' : 'خیلی کوتاه'
}

function formatMemoryStamp(date: Date): string {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    month: 'short',
    day: 'numeric'
  }).format(date)
}

function normalizeMarkdown(content: string): string {
  return content.replace(/\r\n/g, '\n').trimEnd() + '\n'
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
