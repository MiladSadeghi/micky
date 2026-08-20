import assert from 'node:assert/strict'
import test from 'node:test'
import { copyPlaybackAudio } from './tts'

test('copies ArrayBuffer and Uint8Array playback payloads', () => {
  assert.deepEqual([...new Uint8Array(copyPlaybackAudio(Uint8Array.from([9, 8, 7]).buffer))], [9, 8, 7])
  assert.deepEqual([...new Uint8Array(copyPlaybackAudio(Uint8Array.from([1, 2, 3])))], [1, 2, 3])
})

test('reconstructs Node Buffer JSON sent across IPC', () => {
  assert.deepEqual([...new Uint8Array(copyPlaybackAudio({ type: 'Buffer', data: [4, 5, 6] }))], [4, 5, 6])
})

test('treats missing playback audio as empty', () => {
  assert.equal(copyPlaybackAudio(null).byteLength, 0)
  assert.equal(copyPlaybackAudio({}).byteLength, 0)
})
