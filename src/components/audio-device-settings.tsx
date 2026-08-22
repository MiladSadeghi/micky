import { Mic, RefreshCw, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel
} from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import type { AudioDevices } from '@/hooks/use-audio-devices'
import { DEFAULT_AUDIO_DEVICE_ID, type SettingsSnapshot } from '@/lib/settings'
import type { AudioDeviceOption } from '@/lib/audio-devices'
import { cn } from '@/lib/utils'

type AudioDeviceSettingsProps = {
  settings: SettingsSnapshot | null
  devices: AudioDevices
  mode?: 'both' | 'input' | 'output'
  compact?: boolean
}

export function AudioDeviceSettings({
  settings,
  devices,
  mode = 'both',
  compact = false
}: AudioDeviceSettingsProps): React.JSX.Element {
  const content = (
    <FieldGroup className={cn(compact ? 'gap-2' : 'gap-4')}>
      {mode !== 'output' ? (
        <DeviceField
          id="audio-input-device"
          label={mode === 'both' ? 'میکروفن' : 'دستگاه ورودی'}
          description="برای عبارت بیدارباش، گفتگو و دیکته استفاده می‌شود"
          icon={Mic}
          devices={devices.inputs}
          selectedId={settings?.inputDeviceId ?? DEFAULT_AUDIO_DEVICE_ID}
          disabled={!settings || devices.loading}
          compact={compact}
          onChange={(deviceId) => window.api.settings.setAudioDevice('input', deviceId)}
        />
      ) : null}
      {mode !== 'input' ? (
        <DeviceField
          id="audio-output-device"
          label={mode === 'both' ? 'خروجی صدا' : 'دستگاه پخش'}
          description="جواب‌های صوتی و صداهای کوتاه میکی از این دستگاه پخش می‌شوند"
          icon={Volume2}
          devices={devices.outputs}
          selectedId={settings?.outputDeviceId ?? DEFAULT_AUDIO_DEVICE_ID}
          disabled={!settings || devices.loading}
          compact={compact}
          onChange={(deviceId) => window.api.settings.setAudioDevice('output', deviceId)}
        />
      ) : null}
      {devices.error ? <FieldError>{devices.error}</FieldError> : null}
      <Button
        type="button"
        variant="outline"
        size={compact ? 'xs' : 'sm'}
        className="self-start"
        disabled={devices.loading}
        onClick={() => void (mode === 'output' ? devices.refresh() : devices.requestAccess())}
      >
        <RefreshCw data-icon="inline-start" />
        {devices.loading
          ? 'در حال بررسی…'
          : mode === 'input'
            ? 'بررسی دوباره میکروفن‌ها'
            : mode === 'output'
              ? 'بررسی دوباره خروجی‌ها'
              : 'بررسی دوباره دستگاه‌ها'}
      </Button>
    </FieldGroup>
  )

  if (compact) return content
  return (
    <Card size="sm" className="bg-card/30">
      <CardHeader>
        <CardTitle>{mode === 'input' ? 'میکروفن' : 'خروجی صدا'}</CardTitle>
        <CardDescription>
          {mode === 'input'
            ? 'میکروفنی که میکی برای شنیدن صدای تو استفاده می‌کند'
            : 'دستگاهی که جواب‌ها و صداهای کوتاه میکی را پخش می‌کند'}
        </CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}

function DeviceField({
  id,
  label,
  description,
  icon: Icon,
  devices,
  selectedId,
  disabled,
  compact,
  onChange
}: {
  id: string
  label: string
  description: string
  icon: typeof Mic
  devices: AudioDeviceOption[]
  selectedId: string
  disabled: boolean
  compact: boolean
  onChange: (deviceId: string) => Promise<SettingsSnapshot>
}): React.JSX.Element {
  const unavailable =
    selectedId !== DEFAULT_AUDIO_DEVICE_ID && !devices.some((device) => device.id === selectedId)
  return (
    <Field orientation="responsive">
      <FieldContent>
        <FieldLabel htmlFor={id} className="gap-2">
          <Icon aria-hidden="true" />
          {label}
        </FieldLabel>
        {!compact || unavailable ? (
          <FieldDescription className="text-[0.68rem] leading-5">
            {unavailable
              ? 'دستگاه انتخابی فعلاً در دسترس نیست؛ پیش‌فرض سیستم فعال است.'
              : description}
          </FieldDescription>
        ) : null}
      </FieldContent>
      <Select value={selectedId} onValueChange={(value) => value && void onChange(value)}>
        <SelectTrigger id={id} className="w-full @md/field-group:w-72" disabled={disabled}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value={DEFAULT_AUDIO_DEVICE_ID}>پیش‌فرض سیستم</SelectItem>
            {unavailable ? (
              <SelectItem value={selectedId}>دستگاه انتخابی (قطع شده)</SelectItem>
            ) : null}
            {devices.map((device) => (
              <SelectItem key={device.id} value={device.id}>
                {device.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}
