export const WEB_SEARCH_SNAPSHOT_CHANNEL = 'web-search:snapshot'

export const EXA_KEYS_URL = 'https://dashboard.exa.ai/api-keys'
export const FIRECRAWL_KEYS_URL = 'https://www.firecrawl.dev/app/api-keys'

export const WEB_SEARCH_PROVIDER_IDS = ['exa', 'firecrawl', 'google'] as const

export type WebSearchProviderId = (typeof WEB_SEARCH_PROVIDER_IDS)[number]
export type WebSearchApiProviderId = Exclude<WebSearchProviderId, 'google'>

export type WebSearchSettings = {
  enabledProviders: WebSearchProviderId[]
}

export const DEFAULT_WEB_SEARCH_SETTINGS: WebSearchSettings = {
  enabledProviders: []
}

export type WebSearchProviderSnapshot = {
  id: WebSearchProviderId
  enabled: boolean
  available: boolean
  hasApiKey: boolean
  requiresApiKey: boolean
  experimental: boolean
}

export type WebSearchSnapshot = {
  keychainAvailable: boolean
  toolAvailable: boolean
  providers: WebSearchProviderSnapshot[]
}

export type WebSearchResult = {
  title: string
  url: string
  snippet?: string
  publishedAt?: string
  author?: string
}

export type WebSearchResponse = {
  query: string
  provider: WebSearchProviderId
  results: WebSearchResult[]
  fallbackFrom?: WebSearchProviderId
}

export function isWebSearchProviderId(value: unknown): value is WebSearchProviderId {
  return WEB_SEARCH_PROVIDER_IDS.includes(value as WebSearchProviderId)
}

export function isWebSearchApiProviderId(value: unknown): value is WebSearchApiProviderId {
  return value === 'exa' || value === 'firecrawl'
}
