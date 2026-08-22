import { basename, extname } from 'node:path'

const CONFIRM_EXTENSIONS = new Set([
  '.action',
  '.applescript',
  '.bash',
  '.bat',
  '.cmd',
  '.com',
  '.command',
  '.desktop',
  '.fish',
  '.inf',
  '.mobileconfig',
  '.plist',
  '.ps1',
  '.psd1',
  '.psm1',
  '.reg',
  '.scpt',
  '.service',
  '.sh',
  '.socket',
  '.timer',
  '.vbe',
  '.vbs',
  '.workflow',
  '.wsf',
  '.wsh',
  '.zsh'
])

const CONFIRM_BASENAMES = new Set([
  '.bash_login',
  '.bash_profile',
  '.bashrc',
  '.gitconfig',
  '.profile',
  '.zlogin',
  '.zlogout',
  '.zprofile',
  '.zshrc',
  'crontab'
])

const CONFIRM_PATH_SEGMENTS = [
  ['.git', 'hooks'],
  ['.config', 'autostart'],
  ['.config', 'systemd', 'user'],
  ['library', 'launchagents'],
  ['library', 'launchdaemons']
]

/**
 * Plain text and source files are safe to write directly. Confirmation remains
 * for formats and destinations that can execute automatically or change OS and
 * shell startup behavior.
 */
export function writeNeedsApproval(path: string): boolean {
  const normalized = path.replaceAll('\\', '/').toLowerCase()
  const parts = normalized.split('/').filter(Boolean)
  const name = basename(normalized)

  if (CONFIRM_BASENAMES.has(name)) return true
  if (CONFIRM_EXTENSIONS.has(extname(name))) return true

  return CONFIRM_PATH_SEGMENTS.some((segments) => containsSequence(parts, segments))
}

function containsSequence(parts: string[], sequence: string[]): boolean {
  if (sequence.length > parts.length) return false
  for (let start = 0; start <= parts.length - sequence.length; start++) {
    if (sequence.every((part, offset) => parts[start + offset] === part)) return true
  }
  return false
}
