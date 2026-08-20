import assert from 'node:assert/strict'
import test from 'node:test'
import { extractCleanContent, fetchCleanWebpage, validatePublicUrl } from './web-fetch'

const PUBLIC_DNS = async (): Promise<Array<{ address: string; family: number }>> => [
  { address: '93.184.216.34', family: 4 }
]

test('public web fetch blocks local and private destinations', async () => {
  await assert.rejects(() => validatePublicUrl('http://localhost/admin', PUBLIC_DNS), /خصوصی/)
  await assert.rejects(() => validatePublicUrl('http://127.0.0.1/admin', PUBLIC_DNS), /خصوصی/)
  await assert.rejects(
    () =>
      validatePublicUrl('https://internal.example', async () => [
        { address: '10.0.0.4', family: 4 }
      ]),
    /خصوصی/
  )
  assert.equal(
    (await validatePublicUrl('https://example.com/article', PUBLIC_DNS)).hostname,
    'example.com'
  )
})

test('extracts article text without navigation, scripts, or HTML', () => {
  const result = extractCleanContent(
    `<!doctype html><html><head><title>Useful page</title></head><body>
      <nav>Navigation links</nav>
      <article><h1>A clear title</h1><p>This is the useful article body with enough readable information for Micky to summarize.</p><p>It has a second useful paragraph.</p></article>
      <script>window.secret = 'not content'</script>
    </body></html>`,
    new URL('https://example.com/article')
  )
  assert.match(result.content, /useful article body/)
  assert.doesNotMatch(result.content, /window\.secret/)
  assert.doesNotMatch(result.content, /<article>/)
  assert.equal(result.url, 'https://example.com/article')
})

test('validates redirect destinations before following them', async () => {
  let calls = 0
  const fetchImpl = (async () => {
    calls += 1
    return new Response(null, {
      status: 302,
      headers: { location: 'http://127.0.0.1/private' }
    })
  }) as typeof fetch

  await assert.rejects(
    () => fetchCleanWebpage('https://example.com', { fetchImpl, lookup: PUBLIC_DNS }),
    /خصوصی/
  )
  assert.equal(calls, 1)
})
