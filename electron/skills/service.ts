import { createHash } from 'node:crypto'
import { readFile, readdir, realpath, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import {
  BUNDLED_SKILL_SOURCE,
  MICKY_APP_GUIDE_SKILL_NAME,
  type SkillSummary,
  type SkillsSnapshot
} from '@/lib/skills'
import type { SettingsStore } from '../settings/store'

const SKILL_FILE_NAME = 'SKILL.md'
const MAX_DISCOVERY_DEPTH = 3
const MAX_SCANNED_DIRECTORIES = 1_000
const MAX_SKILL_BYTES = 512_000
const MAX_LOADED_CHARS = 60_000
const MAX_RESOURCE_BYTES = 256_000
const MAX_RESOURCE_FILES = 80

type SkillRoot = { path: string; source: string }

type SkillRecord = SkillSummary & {
  filePath: string
  directory: string
}

export type LoadedSkill = {
  id: string
  name: string
  instructions: string
  directory: string
  resources: string[]
  truncated: boolean
}

export type SkillResource = {
  skill: string
  path: string
  content: string
  truncated: boolean
}

// skills.sh keeps shared installs in ~/.agents/skills and can symlink or copy them into
// any supported agent's global directory. Scan both forms so the install choice is invisible.
const GLOBAL_SKILL_DIRECTORIES = [
  ['.agents/skills', 'مشترک'],
  ['.config/agents/skills', 'Universal'],
  ['.codex/skills', 'Codex'],
  ['.claude/skills', 'Claude Code'],
  ['.cursor/skills', 'Cursor'],
  ['.gemini/skills', 'Gemini'],
  ['.config/opencode/skills', 'OpenCode'],
  ['.copilot/skills', 'GitHub Copilot'],
  ['.factory/skills', 'Droid'],
  ['.aider-desk/skills', 'AiderDesk'],
  ['.gemini/antigravity/skills', 'Antigravity'],
  ['.gemini/antigravity-cli/skills', 'Antigravity CLI'],
  ['.astrbot/data/skills', 'AstrBot'],
  ['.autohand/skills', 'Autohand'],
  ['.augment/skills', 'Augment'],
  ['.bob/skills', 'Bob'],
  ['.openclaw/skills', 'OpenClaw'],
  ['.codeartsdoer/skills', 'CodeArts'],
  ['.codebuddy/skills', 'CodeBuddy'],
  ['.codemaker/skills', 'Codemaker'],
  ['.codestudio/skills', 'Code Studio'],
  ['.commandcode/skills', 'Command Code'],
  ['.continue/skills', 'Continue'],
  ['.snowflake/cortex/skills', 'Cortex'],
  ['.config/crush/skills', 'Crush'],
  ['.deepagents/agent/skills', 'Deep Agents'],
  ['.config/devin/skills', 'Devin'],
  ['.firebender/skills', 'Firebender'],
  ['.forge/skills', 'ForgeCode'],
  ['.config/goose/skills', 'Goose'],
  ['.grok/skills', 'Grok'],
  ['.hermes/skills', 'Hermes'],
  ['.inferencesh/skills', 'inference.sh'],
  ['.jazz/skills', 'Jazz'],
  ['.junie/skills', 'Junie'],
  ['.iflow/skills', 'iFlow'],
  ['.kilocode/skills', 'Kilo Code'],
  ['.config/kimchi/harness/skills', 'Kimchi'],
  ['.kiro/skills', 'Kiro'],
  ['.kode/skills', 'Kode'],
  ['.lingma/skills', 'Lingma'],
  ['.mcpjam/skills', 'MCPJam'],
  ['.minimax/skills', 'MiniMax'],
  ['.vibe/skills', 'Mistral Vibe'],
  ['.moxby/skills', 'Moxby'],
  ['.mux/skills', 'Mux'],
  ['.openhands/skills', 'OpenHands'],
  ['.ona/skills', 'Ona'],
  ['.pi/agent/skills', 'Pi'],
  ['.posit/assistant/skills', 'Posit'],
  ['.qoder/skills', 'Qoder'],
  ['.qwen/skills', 'Qwen'],
  ['.reasonix/skills', 'Reasonix'],
  ['.rovodev/skills', 'Rovo Dev'],
  ['.roo/skills', 'Roo Code'],
  ['.tabnine/agent/skills', 'Tabnine'],
  ['.terramind/skills', 'Terramind'],
  ['.tinycloud/skills', 'Tinycloud'],
  ['.trae/skills', 'Trae'],
  ['.trae-cn/skills', 'Trae CN'],
  ['.codeium/windsurf/skills', 'Windsurf'],
  ['.zcode/skills', 'ZCode'],
  ['.zencoder/skills', 'Zencoder'],
  ['.neovate/skills', 'Neovate'],
  ['.pochi/skills', 'Pochi'],
  ['.adal/skills', 'AdaL']
] as const

export class SkillService {
  #records = new Map<string, SkillRecord>()
  #scannedAt = 0
  readonly #roots: SkillRoot[]

  constructor(
    private readonly settings: SettingsStore,
    options: { home?: string; roots?: SkillRoot[]; bundledRoot?: string } = {}
  ) {
    const home = options.home ?? homedir()
    this.#roots = options.roots ?? [
      ...(options.bundledRoot ? [{ path: options.bundledRoot, source: BUNDLED_SKILL_SOURCE }] : []),
      ...GLOBAL_SKILL_DIRECTORIES.map(([path, source]) => ({ path: join(home, path), source }))
    ]
  }

  async refresh(): Promise<SkillsSnapshot> {
    const discovered = await discoverSkills(this.#roots)
    this.#records = new Map(discovered.map((skill) => [skill.id, skill]))
    this.#scannedAt = Date.now()
    return this.getSnapshot()
  }

  getSnapshot(): SkillsSnapshot {
    const settings = this.settings.get()
    const disabled = new Set(settings.disabledSkillIds)
    return {
      enabled: settings.skillsEnabled,
      skills: [...this.#records.values()].map((skill) => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        source: skill.source,
        hasResources: skill.hasResources,
        enabled: !disabled.has(skill.id)
      })),
      scannedAt: this.#scannedAt
    }
  }

  async setEnabled(enabled: boolean): Promise<SkillsSnapshot> {
    await this.settings.update({ skillsEnabled: enabled })
    return this.getSnapshot()
  }

  async setSkillEnabled(id: string, enabled: boolean): Promise<SkillsSnapshot> {
    if (!this.#records.has(id)) throw new Error('Skill not found.')
    const disabled = new Set(this.settings.get().disabledSkillIds)
    if (enabled) disabled.delete(id)
    else disabled.add(id)
    await this.settings.update({ disabledSkillIds: [...disabled] })
    return this.getSnapshot()
  }

  getEnabledCatalog(): SkillSummary[] {
    if (!this.settings.get().skillsEnabled) return []
    return this.getSnapshot().skills.filter((skill) => skill.enabled)
  }

  async load(id: string): Promise<LoadedSkill> {
    const record = this.#enabledRecord(id)
    const raw = await readFile(record.filePath, 'utf8')
    const instructions = cap(raw, MAX_LOADED_CHARS)
    return {
      id: record.id,
      name: record.name,
      instructions,
      directory: record.directory,
      resources: await listSkillResources(record.directory),
      truncated: instructions.length < raw.trim().length
    }
  }

  async readResource(id: string, resourcePath: string): Promise<SkillResource> {
    const record = this.#enabledRecord(id)
    const normalized = resourcePath.trim()
    if (!normalized || isAbsolute(normalized) || normalized.includes('\0')) {
      throw new Error('Invalid skill resource path.')
    }
    const candidate = resolve(record.directory, normalized)
    if (!isInside(record.directory, candidate)) {
      throw new Error('Skill resource is outside its directory.')
    }
    const resolved = await realpath(candidate)
    if (!isInside(record.directory, resolved) || resolved === record.filePath) {
      throw new Error('Skill resource is outside its directory.')
    }
    const info = await stat(resolved)
    if (!info.isFile()) throw new Error('Skill resource is not a file.')
    const buffer = await readFile(resolved)
    if (buffer.subarray(0, 8_192).includes(0)) throw new Error('Skill resource is not text.')
    const truncated = buffer.byteLength > MAX_RESOURCE_BYTES
    return {
      skill: record.name,
      path: normalized,
      content: buffer.subarray(0, MAX_RESOURCE_BYTES).toString('utf8'),
      truncated
    }
  }

  #enabledRecord(id: string): SkillRecord {
    const settings = this.settings.get()
    const record = this.#records.get(id)
    if (!record || !settings.skillsEnabled || settings.disabledSkillIds.includes(id)) {
      throw new Error('Skill is unavailable or disabled.')
    }
    return record
  }
}

async function discoverSkills(roots: SkillRoot[]): Promise<SkillRecord[]> {
  const records: SkillRecord[] = []
  const seenFiles = new Set<string>()
  let scannedDirectories = 0

  const walk = async (directory: string, source: string, depth: number): Promise<void> => {
    if (scannedDirectories++ >= MAX_SCANNED_DIRECTORIES) return
    const skillFile = join(directory, SKILL_FILE_NAME)
    try {
      const resolvedFile = await realpath(skillFile)
      if (seenFiles.has(resolvedFile)) return
      const info = await stat(resolvedFile)
      if (!info.isFile() || info.size > MAX_SKILL_BYTES) return
      const metadata = parseSkillFrontmatter(await readFile(resolvedFile, 'utf8'))
      if (!metadata) return
      const skillDirectory = dirname(resolvedFile)
      seenFiles.add(resolvedFile)
      records.push({
        id: skillId(resolvedFile),
        name: metadata.name,
        description: metadata.description,
        source,
        enabled: true,
        hasResources: await hasSkillResources(skillDirectory),
        filePath: resolvedFile,
        directory: skillDirectory
      })
      return
    } catch {
      // A missing or malformed candidate is skipped; discovery continues below it.
    }

    if (depth >= MAX_DISCOVERY_DEPTH) return
    let entries
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const child = join(directory, entry.name)
      if (entry.isDirectory()) {
        await walk(child, source, depth + 1)
        continue
      }
      if (entry.isSymbolicLink()) {
        try {
          if ((await stat(child)).isDirectory()) await walk(child, source, depth + 1)
        } catch {
          // Ignore broken links.
        }
      }
    }
  }

  for (const root of roots) await walk(root.path, root.source, 0)
  return records.sort((a, b) => {
    const featuredOrder =
      Number(b.name === MICKY_APP_GUIDE_SKILL_NAME) - Number(a.name === MICKY_APP_GUIDE_SKILL_NAME)
    return featuredOrder || a.name.localeCompare(b.name, 'en')
  })
}

export function parseSkillFrontmatter(
  markdown: string
): { name: string; description: string } | null {
  const normalized = markdown.replace(/^\uFEFF/, '').replaceAll('\r\n', '\n')
  if (!normalized.startsWith('---\n')) return null
  const end = normalized.indexOf('\n---', 4)
  if (end < 0) return null
  const lines = normalized.slice(4, end).split('\n')
  const name = readYamlText(lines, 'name', 120)
  const description = readYamlText(lines, 'description', 600)
  if (!name || !description) return null
  return { name, description }
}

function readYamlText(lines: string[], key: string, max: number): string {
  const pattern = new RegExp(`^${key}:\\s*(.*)$`)
  for (let index = 0; index < lines.length; index++) {
    const match = lines[index]?.match(pattern)
    if (!match) continue
    const value = match[1]?.trim() ?? ''
    if (value === '|' || value === '>' || value === '|-' || value === '>-') {
      const parts: string[] = []
      for (let next = index + 1; next < lines.length; next++) {
        const line = lines[next] ?? ''
        if (line && !/^\s/.test(line)) break
        parts.push(line.trim())
      }
      return cleanMetadata(parts.join(value.startsWith('>') ? ' ' : '\n'), max)
    }
    return cleanMetadata(unquote(value), max)
  }
  return ''
}

function unquote(value: string): string {
  if (value.length < 2) return value
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value) as string
    } catch {
      return value.slice(1, -1)
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll("''", "'")
  }
  return value
}

function cleanMetadata(value: string, max: number): string {
  return value
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

async function hasSkillResources(directory: string): Promise<boolean> {
  try {
    const entries = await readdir(directory)
    return entries.some((name) => name !== SKILL_FILE_NAME && !name.startsWith('.'))
  } catch {
    return false
  }
}

async function listSkillResources(directory: string): Promise<string[]> {
  const resources: string[] = []
  const walk = async (current: string, depth: number): Promise<void> => {
    if (resources.length >= MAX_RESOURCE_FILES || depth > MAX_DISCOVERY_DEPTH) return
    let entries
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (resources.length >= MAX_RESOURCE_FILES) return
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const candidate = join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(candidate, depth + 1)
      } else if (entry.isFile() && entry.name !== SKILL_FILE_NAME) {
        resources.push(relative(directory, candidate))
      }
    }
  }
  await walk(directory, 0)
  return resources
}

function skillId(filePath: string): string {
  return createHash('sha256').update(filePath).digest('hex').slice(0, 16)
}

function isInside(root: string, target: string): boolean {
  const rel = relative(root, target)
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))
}

function cap(value: string, max: number): string {
  const trimmed = value.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 14).trimEnd()}\n…[truncated]`
}
