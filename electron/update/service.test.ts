import assert from 'node:assert/strict'
import test from 'node:test'
import { AppUpdateService } from './service'

test('checks GitHub releases and opens the matching download asset', async () => {
  const opened: string[] = []
  const service = new AppUpdateService({
    currentVersion: '0.0.4',
    currentReleaseNotes: '- Current change',
    platform: 'darwin',
    arch: 'arm64',
    getWindow: () => null,
    openExternal: async (url) => {
      opened.push(url)
    },
    fetchRelease: async () =>
      new Response(
        JSON.stringify({
          tag_name: 'v0.0.5',
          name: 'Micky 0.0.5',
          body: '- A new thing',
          html_url: 'https://github.com/xmannii/micky/releases/tag/v0.0.5',
          published_at: '2026-08-22T00:00:00Z',
          assets: [
            {
              name: 'micky-0.0.5-arm64.dmg',
              browser_download_url:
                'https://github.com/xmannii/micky/releases/download/v0.0.5/micky-0.0.5-arm64.dmg'
            }
          ]
        }),
        { status: 200 }
      )
  })

  const snapshot = await service.check()
  assert.equal(snapshot.phase, 'ready')
  assert.equal(snapshot.updateAvailable, true)
  assert.equal(snapshot.latestVersion, '0.0.5')
  await service.openDownload()
  assert.equal(
    opened[0],
    'https://github.com/xmannii/micky/releases/download/v0.0.5/micky-0.0.5-arm64.dmg'
  )
})

test('falls back to the release page when this platform has no asset', async () => {
  const opened: string[] = []
  const service = new AppUpdateService({
    currentVersion: '0.0.4',
    currentReleaseNotes: '',
    platform: 'linux',
    arch: 'x64',
    getWindow: () => null,
    openExternal: async (url) => {
      opened.push(url)
    },
    fetchRelease: async () =>
      new Response(
        JSON.stringify({
          tag_name: 'v0.0.5',
          name: null,
          body: null,
          html_url: 'https://github.com/xmannii/micky/releases/tag/v0.0.5',
          published_at: null,
          assets: []
        }),
        { status: 200 }
      )
  })

  const snapshot = await service.check()
  assert.equal(snapshot.downloadUrl, null)
  await service.openDownload()
  assert.equal(opened[0], 'https://github.com/xmannii/micky/releases/tag/v0.0.5')
})

test('loads the tagged changelog when GitHub only supplies a compare link', async () => {
  const service = new AppUpdateService({
    currentVersion: '0.0.4',
    currentReleaseNotes: '',
    platform: 'darwin',
    arch: 'arm64',
    getWindow: () => null,
    openExternal: async () => {},
    fetchRelease: async (url) => {
      if (url.includes('raw.githubusercontent.com')) {
        return new Response(
          '# Changelog\n\n## 0.0.5 — today\n\n### Added\n\n- Update checks.\n\n## 0.0.4 — yesterday\n\n- Older.',
          { status: 200 }
        )
      }
      return new Response(
        JSON.stringify({
          tag_name: 'v0.0.5',
          name: 'Micky 0.0.5',
          body: '**Full Changelog**: https://github.com/xmannii/micky/compare/v0.0.4...v0.0.5',
          html_url: 'https://github.com/xmannii/micky/releases/tag/v0.0.5',
          published_at: null,
          assets: []
        }),
        { status: 200 }
      )
    }
  })

  const snapshot = await service.check()
  assert.equal(snapshot.releaseNotes, '### Added\n\n- Update checks.')
})
