import type { BrowserWindow } from 'electron'
import {
  APP_UPDATE_SNAPSHOT_CHANNEL,
  MICKY_LATEST_RELEASE_API,
  MICKY_RELEASES_URL,
  compareVersions,
  extractVersionNotes,
  normalizeVersion,
  selectReleaseAsset,
  type AppUpdateSnapshot,
  type ReleaseAsset
} from '@/lib/app-update'

type GithubRelease = {
  tag_name: string
  name: string | null
  body: string | null
  html_url: string
  published_at: string | null
  assets: Array<{ name: string; browser_download_url: string }>
}

type AppUpdateServiceOptions = {
  currentVersion: string
  currentReleaseNotes: string
  platform: string
  arch: string
  getWindow: () => BrowserWindow | null
  openExternal: (url: string) => Promise<void>
  fetchRelease?: (url: string, init: RequestInit) => Promise<Response>
}

export class AppUpdateService {
  private readonly options: AppUpdateServiceOptions
  private snapshot: AppUpdateSnapshot
  private pendingCheck: Promise<AppUpdateSnapshot> | null = null

  constructor(options: AppUpdateServiceOptions) {
    this.options = options
    this.snapshot = {
      phase: 'idle',
      currentVersion: normalizeVersion(options.currentVersion),
      currentReleaseNotes: options.currentReleaseNotes,
      latestVersion: null,
      releaseName: null,
      releaseNotes: '',
      publishedAt: null,
      updateAvailable: false,
      downloadUrl: null,
      releaseUrl: MICKY_RELEASES_URL,
      checkedAt: null,
      error: null
    }
  }

  getSnapshot(): AppUpdateSnapshot {
    return { ...this.snapshot }
  }

  check(): Promise<AppUpdateSnapshot> {
    if (this.pendingCheck) return this.pendingCheck
    this.snapshot = { ...this.snapshot, phase: 'checking', error: null }
    this.emit()
    this.pendingCheck = this.performCheck().finally(() => {
      this.pendingCheck = null
    })
    return this.pendingCheck
  }

  async openDownload(): Promise<void> {
    const target = this.snapshot.downloadUrl ?? this.snapshot.releaseUrl
    await this.options.openExternal(requireTrustedReleaseUrl(target))
  }

  async openReleases(): Promise<void> {
    await this.options.openExternal(MICKY_RELEASES_URL)
  }

  private async performCheck(): Promise<AppUpdateSnapshot> {
    try {
      const fetchRelease = this.options.fetchRelease ?? fetch
      const response = await fetchRelease(MICKY_LATEST_RELEASE_API, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': `Micky/${this.snapshot.currentVersion}`,
          'X-GitHub-Api-Version': '2022-11-28'
        },
        signal: AbortSignal.timeout(8_000)
      })
      if (!response.ok) throw new Error(`GitHub returned ${response.status}.`)
      const release = asGithubRelease(await response.json())
      const latestVersion = normalizeVersion(release.tag_name)
      const updateAvailable = compareVersions(latestVersion, this.snapshot.currentVersion) > 0
      const releaseNotes = await loadReleaseNotes(fetchRelease, release, latestVersion)
      const assets: ReleaseAsset[] = release.assets.flatMap((asset) => {
        try {
          return [
            {
              name: asset.name,
              downloadUrl: requireTrustedReleaseUrl(asset.browser_download_url)
            }
          ]
        } catch {
          return []
        }
      })
      const selectedAsset = selectReleaseAsset(assets, this.options.platform, this.options.arch)

      this.snapshot = {
        ...this.snapshot,
        phase: 'ready',
        latestVersion,
        releaseName: release.name?.trim() || `Micky ${latestVersion}`,
        releaseNotes,
        publishedAt: release.published_at,
        updateAvailable,
        downloadUrl: selectedAsset?.downloadUrl ?? null,
        releaseUrl: requireTrustedReleaseUrl(release.html_url),
        checkedAt: new Date().toISOString(),
        error: null
      }
    } catch (error) {
      console.error('Failed to check for Micky updates:', error)
      this.snapshot = {
        ...this.snapshot,
        phase: 'error',
        checkedAt: new Date().toISOString(),
        error: 'Update check failed.'
      }
    }
    this.emit()
    return this.getSnapshot()
  }

  private emit(): void {
    const window = this.options.getWindow()
    if (window && !window.isDestroyed()) {
      window.webContents.send(APP_UPDATE_SNAPSHOT_CHANNEL, this.getSnapshot())
    }
  }
}

async function loadReleaseNotes(
  fetchRelease: (url: string, init: RequestInit) => Promise<Response>,
  release: GithubRelease,
  version: string
): Promise<string> {
  const body = release.body?.trim().slice(0, 20_000) ?? ''
  if (hasSubstantiveReleaseNotes(body) || !/^v?[0-9][0-9A-Za-z._-]*$/.test(release.tag_name)) {
    return body
  }

  try {
    const response = await fetchRelease(
      `https://raw.githubusercontent.com/xmannii/micky/${encodeURIComponent(release.tag_name)}/CHANGELOG.md`,
      {
        headers: { Accept: 'text/plain', 'User-Agent': `Micky/${version}` },
        signal: AbortSignal.timeout(8_000)
      }
    )
    if (!response.ok) return body
    return extractVersionNotes((await response.text()).slice(0, 200_000), version) || body
  } catch {
    return body
  }
}

function hasSubstantiveReleaseNotes(body: string): boolean {
  return body
    .split('\n')
    .some(
      (line) => line.trim() && !/full changelog/i.test(line) && !/^https?:\/\//.test(line.trim())
    )
}

function asGithubRelease(value: unknown): GithubRelease {
  if (!value || typeof value !== 'object') throw new Error('Invalid GitHub release response.')
  const candidate = value as Partial<GithubRelease>
  if (
    typeof candidate.tag_name !== 'string' ||
    typeof candidate.html_url !== 'string' ||
    !Array.isArray(candidate.assets)
  ) {
    throw new Error('Invalid GitHub release response.')
  }
  return {
    tag_name: candidate.tag_name,
    name: typeof candidate.name === 'string' ? candidate.name : null,
    body: typeof candidate.body === 'string' ? candidate.body : null,
    html_url: candidate.html_url,
    published_at: typeof candidate.published_at === 'string' ? candidate.published_at : null,
    assets: candidate.assets.filter(
      (asset): asset is { name: string; browser_download_url: string } =>
        Boolean(
          asset && typeof asset.name === 'string' && typeof asset.browser_download_url === 'string'
        )
    )
  }
}

function requireTrustedReleaseUrl(value: string): string {
  const url = new URL(value)
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'github.com' ||
    !url.pathname.startsWith('/xmannii/micky/releases')
  ) {
    throw new Error('Untrusted update URL.')
  }
  return url.toString()
}
