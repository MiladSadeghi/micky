import { randomUUID } from 'node:crypto'
import { lstat, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative } from 'node:path'
import { capOutput, TOOL_OUTPUT_CAP } from './output'
import { PathDeniedError, lineLooksSecret, resolveSafePath, type PathGuardOptions } from './paths'

const MAX_READ_CHARS = TOOL_OUTPUT_CAP
const MAX_LIST_ENTRIES = 80
const MAX_SEARCH_HITS = 20
const MAX_WALK_FILES = 400
const MAX_WALK_DEPTH = 8
const MAX_GREP_FILE_BYTES = 512 * 1024
export const MAX_WRITE_BYTES = 512 * 1024
const SKIP_DIR_NAMES = new Set([
  '.git',
  '.cache',
  '.Trash',
  'node_modules',
  'Library',
  'Caches',
  'DerivedData'
])

export async function readUserFile(
  inputPath: string,
  options: PathGuardOptions = {}
): Promise<{ path: string; content: string; truncated: boolean }> {
  const path = await resolveSafePath(inputPath, options)
  const stat = await lstat(path)
  if (!stat.isFile()) throw new PathDeniedError('این مسیر یک فایل نیست.')
  const raw = await readFile(path)
  if (raw.includes(0)) {
    return { path, content: 'این فایل باینری است و خوانده نشد.', truncated: false }
  }
  const capped = capOutput(raw.toString('utf8'), MAX_READ_CHARS)
  return { path, content: capped.text, truncated: capped.truncated }
}

export type WriteFileMode = 'create' | 'overwrite' | 'append'

export async function writeUserFile(
  inputPath: string,
  content: string,
  mode: WriteFileMode,
  options: PathGuardOptions = {}
): Promise<{ path: string; bytes: number; mode: WriteFileMode }> {
  if (content.includes('\0')) throw new PathDeniedError('فقط متن UTF-8 قابل نوشتن است.')
  const bytes = Buffer.byteLength(content, 'utf8')
  if (bytes > MAX_WRITE_BYTES) {
    throw new PathDeniedError('متن برای یک بار نوشتن بیش از حد بزرگ است.')
  }

  const initialPath = await resolveSafePath(inputPath, options)
  assertWriteLocation(initialPath)
  await mkdir(dirname(initialPath), { recursive: true })

  // Resolve again after creating the parent so a newly introduced symlink cannot
  // move the write outside the guarded roots.
  const path = await resolveSafePath(initialPath, options)
  assertWriteLocation(path)

  let existing: Awaited<ReturnType<typeof lstat>> | null = null
  try {
    existing = await lstat(path)
  } catch {
    existing = null
  }
  if (existing && !existing.isFile()) {
    throw new PathDeniedError('این مسیر یک فایل متنی معمولی نیست.')
  }
  if (mode === 'create' && existing) {
    throw new PathDeniedError('این فایل از قبل وجود دارد؛ برای تغییرش حالت overwrite را انتخاب کن.')
  }
  if (mode === 'overwrite' && existing) {
    const previous = await readFile(path)
    if (previous.includes(0)) throw new PathDeniedError('نمی‌توانم یک فایل باینری را بازنویسی کنم.')
  }
  if (mode === 'append') {
    const previous = existing ? await readFile(path) : Buffer.alloc(0)
    if (previous.includes(0)) throw new PathDeniedError('نمی‌توانم به فایل باینری متن اضافه کنم.')
    if (previous.byteLength + bytes > MAX_WRITE_BYTES * 4) {
      throw new PathDeniedError('فایل نهایی بیش از حد بزرگ می‌شود.')
    }
    await atomicWrite(path, Buffer.concat([previous, Buffer.from(content, 'utf8')]))
    return { path, bytes, mode }
  }

  await atomicWrite(path, content)
  return { path, bytes, mode }
}

export async function listUserDirectory(
  inputPath: string,
  options: PathGuardOptions = {}
): Promise<{ path: string; entries: string[]; truncated: boolean }> {
  const path = await resolveSafePath(inputPath, options)
  const stat = await lstat(path)
  if (!stat.isDirectory()) throw new PathDeniedError('این مسیر یک پوشه نیست.')
  const names = (await readdir(path)).sort((a, b) => a.localeCompare(b))
  const visible: string[] = []
  for (const name of names) {
    if (visible.length >= MAX_LIST_ENTRIES) break
    const child = join(path, name)
    if (lineLooksSecret(child, options.home)) continue
    try {
      const childStat = await lstat(child)
      visible.push(childStat.isDirectory() ? `${name}/` : name)
    } catch {
      visible.push(name)
    }
  }
  return {
    path,
    entries: visible,
    truncated: names.length > visible.length
  }
}

export async function searchUserFiles(
  query: string,
  directory: string,
  options: PathGuardOptions = {}
): Promise<{ directory: string; matches: string[]; truncated: boolean }> {
  const needle = query.trim().toLowerCase()
  if (!needle) return { directory, matches: [], truncated: false }
  const root = await resolveSafePath(directory, options)
  const matches: string[] = []
  let truncated = false
  await walkFiles(root, root, 0, options, (path, rel, stat) => {
    if (!stat.isFile() && !stat.isDirectory()) return
    if (!basename(path).toLowerCase().includes(needle)) return
    if (matches.length >= MAX_SEARCH_HITS) {
      truncated = true
      return
    }
    matches.push(stat.isDirectory() ? `${rel}/` : rel)
  })
  return { directory: root, matches, truncated }
}

export async function searchInUserFiles(
  query: string,
  directory: string,
  options: PathGuardOptions = {}
): Promise<{ directory: string; hits: string[]; truncated: boolean }> {
  const needle = query.trim()
  if (!needle) return { directory, hits: [], truncated: false }
  const root = await resolveSafePath(directory, options)
  const hits: string[] = []
  let truncated = false
  const lower = needle.toLowerCase()
  await walkFiles(root, root, 0, options, async (path, rel, stat) => {
    if (!stat.isFile() || stat.size > MAX_GREP_FILE_BYTES) return
    if (hits.length >= MAX_SEARCH_HITS) {
      truncated = true
      return
    }
    let raw: Buffer
    try {
      raw = await readFile(path)
    } catch {
      return
    }
    if (raw.includes(0)) return
    const text = raw.toString('utf8')
    const index = text.toLowerCase().indexOf(lower)
    if (index < 0) return
    const line = lineAt(text, index).trim()
    if (lineLooksSecret(line, options.home)) return
    hits.push(`${rel}: ${line.slice(0, 200)}`)
  })
  return { directory: root, hits, truncated }
}

type WalkStat = {
  isFile(): boolean
  isDirectory(): boolean
  isSymbolicLink(): boolean
  size: number
}

async function walkFiles(
  root: string,
  current: string,
  depth: number,
  options: PathGuardOptions,
  visit: (path: string, rel: string, stat: WalkStat) => void | Promise<void>
): Promise<number> {
  let seen = 0
  if (depth > MAX_WALK_DEPTH) return 0
  let names: string[]
  try {
    names = await readdir(current)
  } catch {
    return 0
  }
  for (const name of names) {
    if (seen >= MAX_WALK_FILES) return seen
    const path = join(current, name)
    if (lineLooksSecret(path, options.home)) continue
    let stat: WalkStat
    try {
      stat = await lstat(path)
    } catch {
      continue
    }
    if (stat.isSymbolicLink()) continue
    const rel = relative(root, path) || name
    if (stat.isDirectory()) {
      if (depth === 0 && SKIP_DIR_NAMES.has(name)) continue
      if (SKIP_DIR_NAMES.has(name) && name !== 'Library') continue
      await visit(path, rel, stat)
      seen += 1
      seen += await walkFiles(root, path, depth + 1, options, visit)
      continue
    }
    await visit(path, rel, stat)
    seen += 1
  }
  return seen
}

function lineAt(text: string, index: number): string {
  const start = text.lastIndexOf('\n', Math.max(0, index - 1)) + 1
  const end = text.indexOf('\n', index)
  return text.slice(start, end === -1 ? text.length : end)
}

function assertWriteLocation(path: string): void {
  if (
    process.platform === 'darwin' &&
    (path === '/Applications' || path.startsWith('/Applications/'))
  ) {
    throw new PathDeniedError('نوشتن داخل پوشه برنامه‌ها مجاز نیست.')
  }
}

async function atomicWrite(path: string, content: string | Buffer): Promise<void> {
  const tempPath = join(dirname(path), `.micky-write-${randomUUID()}.tmp`)
  try {
    await writeFile(tempPath, content, { flag: 'wx' })
    await rename(tempPath, path)
  } finally {
    await rm(tempPath, { force: true }).catch(() => undefined)
  }
}
