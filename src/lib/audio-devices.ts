import { DEFAULT_AUDIO_DEVICE_ID } from './settings'

export type AudioDeviceOption = {
  id: string
  label: string
}

export function audioInputConstraints(deviceId: string): MediaTrackConstraints {
  return {
    autoGainControl: false,
    channelCount: 1,
    echoCancellation: false,
    noiseSuppression: false,
    sampleRate: 16_000,
    ...(deviceId !== DEFAULT_AUDIO_DEVICE_ID ? { deviceId: { exact: deviceId } } : {})
  }
}

export function toAudioDeviceOptions(
  devices: MediaDeviceInfo[],
  kind: 'audioinput' | 'audiooutput'
): AudioDeviceOption[] {
  let anonymousIndex = 0
  return devices
    .filter((device) => device.kind === kind && device.deviceId !== DEFAULT_AUDIO_DEVICE_ID)
    .map((device) => {
      anonymousIndex += 1
      return {
        id: device.deviceId,
        label:
          device.label ||
          (kind === 'audioinput'
            ? `میکروفن ${anonymousIndex.toLocaleString('fa-IR')}`
            : `خروجی صدا ${anonymousIndex.toLocaleString('fa-IR')}`)
      }
    })
}

export function availableAudioDeviceId(selectedId: string, devices: AudioDeviceOption[]): string {
  if (selectedId === DEFAULT_AUDIO_DEVICE_ID) return DEFAULT_AUDIO_DEVICE_ID
  return devices.some((device) => device.id === selectedId) ? selectedId : DEFAULT_AUDIO_DEVICE_ID
}
