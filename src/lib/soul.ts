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
