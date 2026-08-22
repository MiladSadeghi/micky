import assert from 'node:assert/strict'
import test from 'node:test'
import {
  audioInputConstraints,
  availableAudioDeviceId,
  toAudioDeviceOptions
} from './audio-devices'

test('uses the system default input without an exact device constraint', () => {
  assert.deepEqual(audioInputConstraints('default').deviceId, undefined)
  assert.deepEqual(audioInputConstraints('mic-1').deviceId, { exact: 'mic-1' })
})

test('falls back when a selected device is unavailable', () => {
  const devices = [{ id: 'mic-1', label: 'Desk mic' }]
  assert.equal(availableAudioDeviceId('mic-1', devices), 'mic-1')
  assert.equal(availableAudioDeviceId('missing', devices), 'default')
})

test('filters device kinds and supplies labels for anonymous devices', () => {
  const devices = [
    { kind: 'audioinput', deviceId: 'mic-1', label: '', groupId: '', toJSON: () => ({}) },
    {
      kind: 'audiooutput',
      deviceId: 'speaker-1',
      label: 'Display',
      groupId: '',
      toJSON: () => ({})
    }
  ] as MediaDeviceInfo[]
  assert.deepEqual(toAudioDeviceOptions(devices, 'audioinput'), [
    { id: 'mic-1', label: 'میکروفن ۱' }
  ])
})
