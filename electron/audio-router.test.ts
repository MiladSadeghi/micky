import assert from 'node:assert/strict'
import test from 'node:test'
import { ASR_PREROLL_SAMPLES } from '@/lib/asr'
import { PrerollBuffer } from './audio-router'

test('keeps a chronological preroll window and wraps when full', () => {
  const preroll = new PrerollBuffer(4)
  preroll.append(Float32Array.from([1, 2]))
  assert.deepEqual([...new Float32Array(preroll.snapshot())], [1, 2])

  preroll.append(Float32Array.from([3, 4, 5]))
  assert.deepEqual([...new Float32Array(preroll.snapshot())], [2, 3, 4, 5])
})

test('clears after a snapshot is taken via take semantics', () => {
  const preroll = new PrerollBuffer(ASR_PREROLL_SAMPLES)
  preroll.append(new Float32Array(8).fill(0.5))
  const first = preroll.snapshot()
  assert.equal(new Float32Array(first).length, 8)
  preroll.clear()
  assert.equal(preroll.snapshot().byteLength, 0)
})
