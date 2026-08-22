import type { BrowserWindow } from 'electron'
import { JSDOM } from 'jsdom'
import {
  WEB_SEARCH_PROVIDER_IDS,
  WEB_SEARCH_SNAPSHOT_CHANNEL,
  type WebSearchApiProviderId,
  type WebSearchProviderId,
  type WebSearchResponse,
  type WebSearchResult,
  type WebSearchSnapshot
} from '@/lib/web-search'
import type { SecretStore } from '../llm/secrets'
import type { SettingsStore } from '../settings/store'

const EXA_SEARCH_URL = 'https://api.exa.ai/search'
const FIRECRAWL_SEARCH_URL = 'https://api.firecrawl.dev/v2/search'
const GOOGLE_SEARCH_URL = 'https://www.google.com/search'
const SEARCH_TIMEOUT_MS = 15_000

type WebSearchServiceOptions = {
  settings: SettingsStore
  secrets: SecretStore
  getWindow: () => BrowserWindow | null
  fetch?: typeof globalThis.fetch
}

type SearchOptions = {
  provider?: WebSearchProviderId
  limit?: number
  abortSignal?: AbortSignal
}

export class WebSearchService {
  constructor(private readonly options: WebSearchServiceOptions) {}

  getAvailableProviderIds(): WebSearchProviderId[] {
    const enabled = new Set(this.options.settings.get().webSearch.enabledProviders)
    return WEB_SEARCH_PROVIDER_IDS.filter(
      (provider) => enabled.has(provider) && this.#providerCanRun(provider)
    )
  }

  hasAvailableProvider(): boolean {
    return this.getAvailableProviderIds().length > 0
  }

  getSnapshot(): WebSearchSnapshot {
    const enabled = new Set(this.options.settings.get().webSearch.enabledProviders)
    const providers = WEB_SEARCH_PROVIDER_IDS.map((id) => {
      const hasApiKey = id === 'google' ? false : this.options.secrets.hasWebSearchApiKey(id)
      const providerEnabled = enabled.has(id)
      return {
        id,
        enabled: providerEnabled,
        available: providerEnabled && this.#providerCanRun(id),
        hasApiKey,
        requiresApiKey: id === 'exa',
        experimental: id === 'google'
      }
    })
    return {
      keychainAvailable: this.options.secrets.keychainAvailable,
      toolAvailable: providers.some((provider) => provider.available),
      providers
    }
  }

  async setProviderEnabled(
    provider: WebSearchProviderId,
    enabled: boolean
  ): Promise<WebSearchSnapshot> {
    if (enabled && provider === 'exa' && !this.options.secrets.hasWebSearchApiKey('exa')) {
      throw new Error('برای روشن‌کردن Exa اول کلید API آن را ذخیره کن.')
    }
    const current = this.options.settings.get().webSearch.enabledProviders
    const next = enabled
      ? [...new Set([...current, provider])]
      : current.filter((item) => item !== provider)
    await this.options.settings.update({ webSearch: { enabledProviders: next } })
    return this.#emitSnapshot()
  }

  async setApiKey(provider: WebSearchApiProviderId, value: string): Promise<WebSearchSnapshot> {
    await this.options.secrets.setWebSearchApiKey(provider, value)
    return this.#emitSnapshot()
  }

  async clearApiKey(provider: WebSearchApiProviderId): Promise<WebSearchSnapshot> {
    await this.options.secrets.clearWebSearchApiKey(provider)
    if (provider === 'exa') {
      const enabledProviders = this.options.settings
        .get()
        .webSearch.enabledProviders.filter((item) => item !== provider)
      await this.options.settings.update({ webSearch: { enabledProviders } })
    }
    return this.#emitSnapshot()
  }

  async search(query: string, options: SearchOptions = {}): Promise<WebSearchResponse> {
    const normalizedQuery = query.trim().slice(0, 500)
    if (!normalizedQuery) throw new Error('عبارت جستجو خالی است.')
    const limit = Math.max(1, Math.min(10, Math.trunc(options.limit ?? 5)))
    const available = this.getAvailableProviderIds()
    if (available.length === 0) throw new Error('هیچ سرویس جستجوی وب فعالی در تنظیمات نیست.')
    if (options.provider && !available.includes(options.provider)) {
      throw new Error('سرویس جستجوی انتخاب‌شده در دسترس نیست.')
    }
    const providers = options.provider
      ? [options.provider, ...available.filter((provider) => provider !== options.provider)]
      : available
    const failures: string[] = []

    for (const provider of providers) {
      try {
        const results = await this.#searchProvider(
          provider,
          normalizedQuery,
          limit,
          options.abortSignal
        )
        return {
          query: normalizedQuery,
          provider,
          results,
          ...(failures.length > 0 ? { fallbackFrom: providers[0] } : {})
        }
      } catch (cause) {
        if (options.abortSignal?.aborted) throw cause
        failures.push(errorMessage(cause))
      }
    }

    throw new Error(failures.at(-1) || 'جستجوی وب ناموفق بود.')
  }

  #providerCanRun(provider: WebSearchProviderId): boolean {
    return provider !== 'exa' || this.options.secrets.hasWebSearchApiKey('exa')
  }

  async #searchProvider(
    provider: WebSearchProviderId,
    query: string,
    limit: number,
    abortSignal?: AbortSignal
  ): Promise<WebSearchResult[]> {
    const fetchImpl = this.options.fetch ?? globalThis.fetch
    const signal = abortSignal
      ? AbortSignal.any([abortSignal, AbortSignal.timeout(SEARCH_TIMEOUT_MS)])
      : AbortSignal.timeout(SEARCH_TIMEOUT_MS)
    if (provider === 'exa') {
      return searchExa(
        fetchImpl,
        this.options.secrets.getWebSearchApiKey('exa')!,
        query,
        limit,
        signal
      )
    }
    if (provider === 'firecrawl') {
      return searchFirecrawl(
        fetchImpl,
        this.options.secrets.getWebSearchApiKey('firecrawl'),
        query,
        limit,
        signal
      )
    }
    return searchGoogle(fetchImpl, query, limit, signal)
  }

  #emitSnapshot(): WebSearchSnapshot {
    const snapshot = this.getSnapshot()
    const window = this.options.getWindow()
    if (window && !window.isDestroyed()) {
      window.webContents.send(WEB_SEARCH_SNAPSHOT_CHANNEL, snapshot)
    }
    return snapshot
  }
}

async function searchExa(
  fetchImpl: typeof globalThis.fetch,
  apiKey: string,
  query: string,
  limit: number,
  signal: AbortSignal
): Promise<WebSearchResult[]> {
  const response = await fetchImpl(EXA_SEARCH_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({ query, numResults: limit, type: 'fast' }),
    signal
  })
  const payload = await readJson(response, 'Exa')
  const results = isRecord(payload) && Array.isArray(payload.results) ? payload.results : []
  return results.map(readExaResult).filter((result): result is WebSearchResult => result !== null)
}

async function searchFirecrawl(
  fetchImpl: typeof globalThis.fetch,
  apiKey: string | null,
  query: string,
  limit: number,
  signal: AbortSignal
): Promise<WebSearchResult[]> {
  const response = await fetchImpl(FIRECRAWL_SEARCH_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
    },
    body: JSON.stringify({ query, limit, sources: ['web'], highlights: false }),
    signal
  })
  const payload = await readJson(response, 'Firecrawl')
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : null
  const results = data && Array.isArray(data.web) ? data.web : []
  return results
    .map(readFirecrawlResult)
    .filter((result): result is WebSearchResult => result !== null)
}

async function searchGoogle(
  fetchImpl: typeof globalThis.fetch,
  query: string,
  limit: number,
  signal: AbortSignal
): Promise<WebSearchResult[]> {
  const url = new URL(GOOGLE_SEARCH_URL)
  url.searchParams.set('q', query)
  url.searchParams.set('num', String(limit))
  url.searchParams.set('hl', 'fa')
  url.searchParams.set('safe', 'active')
  url.searchParams.set('filter', '1')
  url.searchParams.set('pws', '0')
  const response = await fetchImpl(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'fa-IR,fa;q=0.9,en;q=0.7',
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131 Safari/537.36'
    },
    redirect: 'follow',
    signal
  })
  if (!response.ok) throw new Error(`Google با وضعیت ${response.status} پاسخ داد.`)
  const html = await response.text()
  if (/unusual traffic|not a robot|g-recaptcha|consent\.google/i.test(html)) {
    throw new Error('Google درخواست را با کپچا یا صفحهٔ رضایت متوقف کرد.')
  }
  return parseGoogleResults(html, limit)
}

export function parseGoogleResults(html: string, limit = 10): WebSearchResult[] {
  const document = new JSDOM(html).window.document
  const results: WebSearchResult[] = []
  const seen = new Set<string>()
  for (const heading of document.querySelectorAll('h3')) {
    const anchor = heading.closest('a[href]')
    if (!anchor) continue
    const url = normalizeGoogleResultUrl(anchor.getAttribute('href'))
    const title = cleanText(heading.textContent, 300)
    if (!url || !title || seen.has(url)) continue
    seen.add(url)
    let container: Element | null = anchor.parentElement
    let snippet = ''
    for (let depth = 0; container && depth < 5; depth += 1, container = container.parentElement) {
      if (container.querySelectorAll('h3').length > 1) break
      const match = container.querySelector('.VwiC3b, [data-sncf], [data-content-feature="1"]')
      snippet = cleanText(match?.textContent, 700)
      if (snippet && snippet !== title) break
    }
    results.push({ title, url, ...(snippet ? { snippet } : {}) })
    if (results.length >= limit) break
  }
  return results
}

function readExaResult(value: unknown): WebSearchResult | null {
  if (!isRecord(value)) return null
  const url = readPublicUrl(value.url)
  const title = cleanText(value.title, 300)
  if (!url || !title) return null
  const publishedAt = cleanText(value.publishedDate, 80)
  const author = cleanText(value.author, 200)
  return {
    title,
    url,
    ...(publishedAt ? { publishedAt } : {}),
    ...(author ? { author } : {})
  }
}

function readFirecrawlResult(value: unknown): WebSearchResult | null {
  if (!isRecord(value)) return null
  const url = readPublicUrl(value.url)
  const title = cleanText(value.title, 300)
  if (!url || !title) return null
  const snippet = cleanText(value.description ?? value.snippet, 700)
  return { title, url, ...(snippet ? { snippet } : {}) }
}

function normalizeGoogleResultUrl(value: string | null): string | null {
  if (!value) return null
  try {
    const parsed = new URL(value, GOOGLE_SEARCH_URL)
    const candidate = parsed.pathname === '/url' ? parsed.searchParams.get('q') : parsed.href
    if (!candidate) return null
    const result = readPublicUrl(candidate)
    if (!result) return null
    const resultUrl = new URL(result)
    if (
      resultUrl.hostname === 'www.google.com' &&
      ['/search', '/url'].includes(resultUrl.pathname)
    ) {
      return null
    }
    return result
  } catch {
    return null
  }
}

function readPublicUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

async function readJson(response: Response, provider: string): Promise<unknown> {
  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    // The status-specific message below is more useful than a JSON parse error.
  }
  if (!response.ok) {
    const detail =
      isRecord(payload) && typeof payload.error === 'string'
        ? `: ${payload.error.slice(0, 300)}`
        : ''
    throw new Error(`${provider} با وضعیت ${response.status} پاسخ داد${detail}.`)
  }
  return payload
}

function cleanText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error && cause.message.trim() ? cause.message : 'جستجوی وب ناموفق بود.'
}
