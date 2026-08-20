import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'

const MAX_DOWNLOAD_BYTES = 2 * 1024 * 1024
const MAX_CONTENT_CHARS = 18_000
const MAX_REDIRECTS = 5
const FETCH_TIMEOUT_MS = 15_000

type DnsAddress = { address: string; family: number }

export type WebFetchOptions = {
  abortSignal?: AbortSignal
  fetchImpl?: typeof fetch
  lookup?: (hostname: string) => Promise<DnsAddress[]>
}

export type CleanWebpage = {
  url: string
  title: string | null
  byline: string | null
  siteName: string | null
  publishedTime: string | null
  excerpt: string | null
  content: string
  truncated: boolean
}

export async function fetchCleanWebpage(
  input: string,
  options: WebFetchOptions = {}
): Promise<CleanWebpage> {
  const fetchImpl = options.fetchImpl ?? fetch
  const lookup = options.lookup ?? defaultLookup
  let url = await validatePublicUrl(input, lookup)

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS)
    const signal = options.abortSignal ? AbortSignal.any([options.abortSignal, timeout]) : timeout
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'manual',
      signal,
      headers: {
        accept: 'text/html,application/xhtml+xml,text/plain,application/json;q=0.8,*/*;q=0.2',
        'user-agent': 'Micky/1.0 (personal desktop assistant)'
      }
    })

    if (isRedirect(response.status)) {
      if (redirects === MAX_REDIRECTS)
        throw new Error('تعداد تغییر مسیرهای این صفحه بیش از حد است.')
      const location = response.headers.get('location')
      if (!location) throw new Error('تغییر مسیر صفحه مقصد مشخصی ندارد.')
      url = await validatePublicUrl(new URL(location, url).toString(), lookup)
      continue
    }
    if (!response.ok) throw new Error(`دریافت صفحه با خطای ${response.status} روبه‌رو شد.`)

    const contentType = (response.headers.get('content-type') ?? '').toLowerCase()
    if (contentType && !isTextContentType(contentType)) {
      throw new Error('این لینک یک صفحه یا فایل متنی نیست.')
    }
    const declaredLength = Number(response.headers.get('content-length') ?? 0)
    if (Number.isFinite(declaredLength) && declaredLength > MAX_DOWNLOAD_BYTES) {
      throw new Error('این صفحه برای دریافت بیش از حد بزرگ است.')
    }

    const source = await readCappedBody(response)
    return extractCleanContent(source, url, contentType)
  }

  throw new Error('دریافت صفحه ناموفق بود.')
}

export async function validatePublicUrl(
  input: string,
  lookup: (hostname: string) => Promise<DnsAddress[]> = defaultLookup
): Promise<URL> {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    throw new Error('لینک معتبر نیست.')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('فقط لینک‌های عمومی HTTP و HTTPS قابل دریافت‌اند.')
  }
  if (url.username || url.password) throw new Error('لینک دارای نام کاربری یا رمز مجاز نیست.')

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!hostname || isPrivateHostname(hostname)) {
    throw new Error('دسترسی به آدرس‌های محلی یا خصوصی مجاز نیست.')
  }
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await lookup(hostname)
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error('دسترسی به آدرس‌های محلی یا خصوصی مجاز نیست.')
  }
  return url
}

export function extractCleanContent(
  source: string,
  url: URL,
  contentType = 'text/html'
): CleanWebpage {
  if (!contentType.includes('html') && !looksLikeHtml(source)) {
    const clean = normalizeText(source)
    const capped = capContent(clean)
    return {
      url: url.toString(),
      title: null,
      byline: null,
      siteName: url.hostname,
      publishedTime: null,
      excerpt: null,
      content: capped.content,
      truncated: capped.truncated
    }
  }

  const dom = new JSDOM(source, { url: url.toString() })
  try {
    for (const element of dom.window.document.querySelectorAll(
      'script, style, noscript, template, svg, canvas'
    )) {
      element.remove()
    }
    const article = new Readability(dom.window.document, {
      charThreshold: 80,
      maxElemsToParse: 50_000
    }).parse()
    const fallback = dom.window.document.body?.textContent ?? ''
    const clean = normalizeText(article?.textContent || fallback)
    if (!clean) throw new Error('متن قابل خواندنی در این صفحه پیدا نشد.')
    const capped = capContent(clean)
    return {
      url: url.toString(),
      title: cleanMetadata(article?.title) ?? cleanMetadata(dom.window.document.title),
      byline: cleanMetadata(article?.byline),
      siteName: cleanMetadata(article?.siteName) ?? url.hostname,
      publishedTime: cleanMetadata(article?.publishedTime),
      excerpt: cleanMetadata(article?.excerpt),
      content: capped.content,
      truncated: capped.truncated
    }
  } finally {
    dom.window.close()
  }
}

async function defaultLookup(hostname: string): Promise<DnsAddress[]> {
  return dnsLookup(hostname, { all: true, verbatim: true })
}

async function readCappedBody(response: Response): Promise<string> {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    received += value.byteLength
    if (received > MAX_DOWNLOAD_BYTES) {
      await reader.cancel()
      throw new Error('این صفحه برای دریافت بیش از حد بزرگ است.')
    }
    chunks.push(value)
  }
  const combined = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder('utf-8').decode(combined)
}

function isPrivateHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.home') ||
    hostname.endsWith('.lan') ||
    hostname.endsWith('.test')
  )
}

function isPublicAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) {
    const parts = address.split('.').map(Number)
    const [a, b] = parts
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51) ||
      (a === 203 && b === 0) ||
      a >= 224
    )
  }
  if (family === 6) {
    const normalized = address.toLowerCase()
    const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1]
    if (mapped) return isPublicAddress(mapped)
    return !(
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe') ||
      normalized.startsWith('ff') ||
      normalized.startsWith('2001:db8:')
    )
  }
  return false
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308
}

function isTextContentType(contentType: string): boolean {
  return (
    contentType.startsWith('text/') ||
    contentType.includes('html') ||
    contentType.includes('json') ||
    contentType.includes('xml') ||
    contentType.includes('javascript')
  )
}

function looksLikeHtml(source: string): boolean {
  return /<(?:!doctype|html|head|body|article|main)\b/i.test(source.slice(0, 2_000))
}

function normalizeText(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[\t ]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function capContent(content: string): { content: string; truncated: boolean } {
  if (content.length <= MAX_CONTENT_CHARS) return { content, truncated: false }
  return {
    content: `${content.slice(0, MAX_CONTENT_CHARS).trimEnd()}\n[truncated]`,
    truncated: true
  }
}

function cleanMetadata(value: string | null | undefined): string | null {
  const clean = value?.replace(/\s+/g, ' ').trim()
  return clean || null
}
