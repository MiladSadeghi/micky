export const SKILLS_SNAPSHOT_CHANNEL = 'skills:snapshot'

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
