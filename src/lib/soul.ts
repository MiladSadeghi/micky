export const SOUL_SNAPSHOT_CHANNEL = 'soul:snapshot'

export type SoulFileId = 'soul' | 'user' | 'memory'

export type AddressForm = 'to' | 'shoma'
export type LanguageMix = 'persian' | 'mixed'
export type ReplyLength = 'short' | 'medium'

export type UserProfileDraft = {
  name: string
  addressForm: AddressForm
  languageMix: LanguageMix
  city: string
  work: string
  focus: string
  replyLength: ReplyLength
}

export type SoulSnapshot = {
  onboardingCompleted: boolean
  files: Record<SoulFileId, string>
}

export type MarkdownDocumentView = {
  title: string
  statements: string[]
}

export type UserFactView = {
  label: string
  value: string
}

export const SOUL_FILE_NAMES: Record<SoulFileId, string> = {
  soul: 'SOUL.md',
  user: 'USER.md',
  memory: 'MEMORY.md'
}

export const EMPTY_USER_PROFILE: UserProfileDraft = {
  name: '',
  addressForm: 'to',
  languageMix: 'mixed',
  city: '',
  work: '',
  focus: '',
  replyLength: 'short'
}

export function parseMarkdownDocument(
  markdown: string,
  fallbackTitle: string
): MarkdownDocumentView {
  let title = fallbackTitle
  let foundTitle = false
  const statements: string[] = []

  for (const rawLine of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    if (/^#{1,6}\s+/.test(line)) {
      if (!foundTitle) {
        title = cleanMarkdown(line.replace(/^#{1,6}\s+/, '')) || fallbackTitle
        foundTitle = true
      }
      continue
    }

    const statement = cleanMarkdown(line.replace(/^(?:[-*+]\s+|\d+[.)]\s+)/, ''))
    if (statement) statements.push(statement)
  }

  return { title, statements }
}

export function parseUserFacts(markdown: string): UserFactView[] {
  const { statements } = parseMarkdownDocument(markdown, 'کاربر')

  return statements.flatMap((statement) => {
    const separator = statement.indexOf(':')
    if (separator <= 0) return []

    const label = statement.slice(0, separator).trim()
    const value = statement.slice(separator + 1).trim()
    if (!label || !value || value === 'نامشخص' || value.toLowerCase() === 'unknown') return []
    return [{ label, value }]
  })
}

function cleanMarkdown(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_~`]/g, '')
    .trim()
}
