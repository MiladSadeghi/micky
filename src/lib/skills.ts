export const SKILLS_SNAPSHOT_CHANNEL = 'skills:snapshot'
export const BUNDLED_SKILL_SOURCE = 'همراه میکی'
export const MICKY_APP_GUIDE_SKILL_NAME = 'micky-app-guide'

export type SkillSummary = {
  id: string
  name: string
  description: string
  source: string
  enabled: boolean
  hasResources: boolean
}

export type SkillsSnapshot = {
  enabled: boolean
  skills: SkillSummary[]
  scannedAt: number
}
