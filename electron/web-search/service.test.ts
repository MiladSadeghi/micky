import assert from 'node:assert/strict'
import test from 'node:test'
import type { WebSearchProviderId } from '@/lib/web-search'
import { parseGoogleResults, WebSearchService } from './service'

test('Firecrawl search requests metadata only without scrape options', async () => {
  let requestBody: Record<string, unknown> | null = null
  let authorization: string | null = null
  const service = serviceFor('firecrawl', async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>
    authorization = new Headers(init?.headers).get('authorization')
    return Response.json({
      success: true,
      data: {
        web: [
          { title: 'Firecrawl result', url: 'https://example.com/page', description: 'A snippet' }
        ]
      }
    })
  })

  const response = await service.search('micky search', { limit: 3 })

  assert.equal(response.provider, 'firecrawl')
  assert.deepEqual(response.results, [
    { title: 'Firecrawl result', url: 'https://example.com/page', snippet: 'A snippet' }
  ])
  assert.deepEqual(requestBody, {
    query: 'micky search',
    limit: 3,
    sources: ['web'],
    highlights: false
  })
  assert.equal('scrapeOptions' in requestBody!, false)
  assert.equal(authorization, 'Bearer fc-test')
})

test('Exa search does not request page contents', async () => {
  let requestBody: Record<string, unknown> | null = null
  const service = serviceFor('exa', async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>
    return Response.json({
      results: [
        {
          title: 'Exa result',
          url: 'https://example.org/',
          publishedDate: '2026-08-22T00:00:00.000Z',
          author: 'Example'
        }
      ]
    })
  })

  const response = await service.search('latest example')

  assert.equal(response.provider, 'exa')
  assert.equal(response.results[0]?.title, 'Exa result')
  assert.deepEqual(requestBody, { query: 'latest example', numResults: 5, type: 'fast' })
  assert.equal('contents' in requestBody!, false)
})

test('parses regular and redirected Google result links', () => {
  const results = parseGoogleResults(`
    <main>
      <div><a href="https://example.com/a"><h3>First result</h3></a><div class="VwiC3b">First snippet</div></div>
      <div><a href="/url?q=https%3A%2F%2Fexample.org%2Fb"><h3>Second result</h3></a></div>
    </main>
  `)

  assert.deepEqual(results, [
    { title: 'First result', url: 'https://example.com/a', snippet: 'First snippet' },
    { title: 'Second result', url: 'https://example.org/b' }
  ])
})

test('keeps Exa unavailable without a key while keyless providers can run', () => {
  const service = serviceFor(['exa', 'firecrawl', 'google'], async () => Response.json({}))
  const ids = service.getAvailableProviderIds()
  assert.deepEqual(ids, ['exa', 'firecrawl', 'google'])

  const withoutExaKey = serviceFor(['exa', 'firecrawl', 'google'], async () => Response.json({}), {
    exaKey: null
  })
  assert.deepEqual(withoutExaKey.getAvailableProviderIds(), ['firecrawl', 'google'])
})

function serviceFor(
  providers: WebSearchProviderId | WebSearchProviderId[],
  fetchImpl: typeof globalThis.fetch,
  options: { exaKey?: string | null; firecrawlKey?: string | null } = {}
): WebSearchService {
  const enabledProviders = Array.isArray(providers) ? providers : [providers]
  const exaKey = options.exaKey === undefined ? 'exa-test' : options.exaKey
  const firecrawlKey = options.firecrawlKey === undefined ? 'fc-test' : options.firecrawlKey
  return new WebSearchService({
    settings: {
      get: () => ({ webSearch: { enabledProviders } }),
      update: async () => ({})
    } as never,
    secrets: {
      keychainAvailable: true,
      hasWebSearchApiKey: (provider: 'exa' | 'firecrawl') =>
        Boolean(provider === 'exa' ? exaKey : firecrawlKey),
      getWebSearchApiKey: (provider: 'exa' | 'firecrawl') =>
        provider === 'exa' ? exaKey : firecrawlKey
    } as never,
    getWindow: () => null,
    fetch: fetchImpl
  })
}
