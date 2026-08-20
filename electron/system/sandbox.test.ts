import assert from 'node:assert/strict'
import test from 'node:test'
import { isSandboxAvailable, runArgv } from './sandbox'

test('runs a read-only command under Seatbelt when available', async (t) => {
  if (!isSandboxAvailable()) {
    t.skip('sandbox-exec is not available on this platform')
    return
  }
  const result = await runArgv(['/bin/echo', 'micky'], { sandboxed: true, timeoutMs: 5_000 })
  assert.equal(result.ok, true)
  assert.match(result.stdout, /micky/)
  assert.equal(result.sandboxDenied, false)
})
