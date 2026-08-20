import {
  Boxes,
  Check,
  Cloud,
  ExternalLink,
  MonitorCog,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
  type LucideIcon
} from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  LLM_PROVIDER_OPTIONS,
  isLlmProviderId,
  isOpenAiCompatibleProviderId,
  type LlmModelInfo,
  type LlmProviderId,
  type LlmSnapshot
} from '@/lib/llm'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

type LlmSettingsProps = {
  snapshot: LlmSnapshot | null
  compact?: boolean
}

const PROVIDER_ICONS: Record<LlmProviderId, LucideIcon> = {
  openrouter: Cloud,
  custom: SlidersHorizontal,
  ollama: Boxes,
  lmstudio: MonitorCog
}

export function LlmSettings({ snapshot, compact = false }: LlmSettingsProps): React.JSX.Element {
  const providerId = snapshot?.providerId ?? 'openrouter'
  const provider =
    LLM_PROVIDER_OPTIONS.find((option) => option.id === providerId) ?? LLM_PROVIDER_OPTIONS[0]
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState(snapshot?.baseUrl ?? '')
  const [modelId, setModelId] = useState('')
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    setApiKey('')
    setBaseUrl(snapshot?.baseUrl ?? '')
    setModelId('')
    setSaveError(null)
  }, [providerId, snapshot?.baseUrl])

  const run = async (action: () => Promise<LlmSnapshot>): Promise<void> => {
    setBusy(true)
    setSaveError(null)
    try {
      await action()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'ذخیره تنظیمات ممکن نشد.')
    } finally {
      setBusy(false)
    }
  }

  const saveKey = async (): Promise<void> => {
    if (!apiKey.trim()) return
    await run(() => window.api.llm.setApiKey(providerId, apiKey.trim()))
    setApiKey('')
  }

  const saveBaseUrl = async (): Promise<void> => {
    if (!baseUrl.trim() || !isOpenAiCompatibleProviderId(providerId)) return
    await run(() => window.api.llm.setBaseUrl(providerId, baseUrl.trim()))
  }

  const addModel = async (): Promise<void> => {
    if (!modelId.trim()) return
    if (providerId === 'openrouter') {
      await run(() => window.api.llm.addCustomModel(modelId.trim()))
    } else {
      await run(() => window.api.llm.setModel(modelId.trim()))
    }
    setModelId('')
  }

  const keychainReady = snapshot?.keychainAvailable !== false
  const catalog = snapshot?.catalog ?? []
  const ready = snapshot?.configured === true && !snapshot.error

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col gap-3 text-start',
        compact ? 'h-full overflow-y-auto' : 'gap-4'
      )}
    >
      <section className="flex shrink-0 flex-col gap-2">
        {compact ? null : (
          <div className="flex items-end justify-between gap-3 px-0.5">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-sm font-medium">سرویس مدل زبانی</h2>
              <p className="text-[0.68rem] text-muted-foreground">ابری، محلی یا سرور خودت</p>
            </div>
            <Badge variant={ready ? 'secondary' : 'outline'}>
              {ready ? 'آماده' : 'نیاز به تنظیم'}
            </Badge>
          </div>
        )}
        <ToggleGroup
          value={[providerId]}
          multiple={false}
          variant="outline"
          spacing={2}
          className="grid w-full grid-cols-2"
          aria-label="سرویس مدل زبانی"
          onValueChange={(value) => {
            const next = value.at(-1)
            if (isLlmProviderId(next) && next !== providerId) {
              void run(() => window.api.llm.setProvider(next))
            }
          }}
        >
          {LLM_PROVIDER_OPTIONS.map((option) => {
            const Icon = PROVIDER_ICONS[option.id]
            return (
              <ToggleGroupItem
                key={option.id}
                value={option.id}
                aria-label={option.label}
                className="h-auto min-w-0 justify-start px-2.5 py-2"
              >
                <Icon data-icon="inline-start" />
                <span className="flex min-w-0 flex-col items-start gap-0.5">
                  <span className="text-xs font-medium">{option.label}</span>
                  {compact ? null : (
                    <span className="truncate text-[0.6rem] font-normal text-muted-foreground">
                      {option.description}
                    </span>
                  )}
                </span>
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
      </section>

      <Card size="sm" className="shrink-0">
        <CardHeader>
          <CardTitle>{provider.label}</CardTitle>
          <CardDescription className="text-[0.68rem]">
            {provider.id === 'openrouter'
              ? 'یک کلید برای دسترسی به مدل‌های ابری'
              : provider.local
                ? 'مدل‌ها مستقیم روی دستگاهت اجرا می‌شوند'
                : 'هر سروری که API سازگار با OpenAI دارد'}
          </CardDescription>
          <CardAction>
            <Badge variant="outline">
              {provider.id === 'custom' ? 'سفارشی' : provider.local ? 'محلی' : 'ابری'}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <FieldGroup className="gap-3">
            {isOpenAiCompatibleProviderId(providerId) ? (
              <Field>
                <FieldLabel htmlFor={`llm-base-url-${providerId}`}>آدرس API</FieldLabel>
                <div className="flex items-center gap-1.5">
                  <Input
                    id={`llm-base-url-${providerId}`}
                    dir="ltr"
                    inputMode="url"
                    value={baseUrl}
                    onChange={(event) => setBaseUrl(event.target.value)}
                    placeholder="http://localhost:1234/v1"
                    className="text-start text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || !baseUrl.trim() || baseUrl === snapshot?.baseUrl}
                    onClick={() => void saveBaseUrl()}
                  >
                    بررسی
                  </Button>
                </div>
              </Field>
            ) : null}

            <Field data-disabled={!keychainReady}>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor={`llm-api-key-${providerId}`}>کلید API</FieldLabel>
                {providerId === 'openrouter' ? (
                  <Button
                    variant="link"
                    size="xs"
                    className="text-muted-foreground"
                    onClick={() => void window.api.llm.openKeys()}
                  >
                    گرفتن کلید
                    <ExternalLink data-icon="inline-end" />
                  </Button>
                ) : (
                  <Badge variant="ghost">اختیاری</Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Input
                  id={`llm-api-key-${providerId}`}
                  type="password"
                  dir="ltr"
                  autoComplete="off"
                  placeholder={snapshot?.hasApiKey ? '••••••••••••' : 'بدون کلید'}
                  value={apiKey}
                  disabled={!keychainReady}
                  onChange={(event) => setApiKey(event.target.value)}
                  className="text-start text-xs"
                />
                <Button
                  size="sm"
                  disabled={busy || !apiKey.trim() || !keychainReady}
                  onClick={() => void saveKey()}
                >
                  ذخیره
                </Button>
                {snapshot?.hasApiKey ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={busy}
                    aria-label="حذف کلید API"
                    onClick={() => void run(() => window.api.llm.clearApiKey(providerId))}
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </div>
              {!keychainReady ? (
                <FieldDescription className="text-[0.65rem]">
                  کی‌چین سیستم در دسترس نیست؛ GNOME Keyring یا KWallet لازم است.
                </FieldDescription>
              ) : null}
            </Field>
            {saveError ? <FieldError className="text-[0.68rem]">{saveError}</FieldError> : null}
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-between gap-2 py-2 text-[0.65rem] text-muted-foreground">
          <span className={snapshot?.error ? 'text-destructive' : undefined}>
            {snapshot?.error ?? 'اتصال آماده است.'}
          </span>
          {ready ? <Check aria-label="آماده" /> : null}
        </CardFooter>
      </Card>

      <Card size="sm" className={cn('min-h-0', compact ? 'flex-1' : undefined)}>
        <CardHeader>
          <CardTitle>مدل</CardTitle>
          <CardDescription className="text-[0.68rem]">
            {provider.local ? 'مدل‌های نصب‌شده روی سرور محلی' : 'مدلی که با میکی حرف می‌زند'}
          </CardDescription>
          <CardAction>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={busy}
              aria-label="تازه‌کردن مدل‌ها"
              onClick={() => void run(() => window.api.llm.refreshModels())}
            >
              <RefreshCw />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-col gap-2">
          <Field>
            <FieldLabel
              htmlFor={`llm-model-${providerId}`}
              className={compact ? 'sr-only' : undefined}
            >
              شناسه مدل
            </FieldLabel>
            <div className="flex items-center gap-1.5">
              <Input
                id={`llm-model-${providerId}`}
                dir="ltr"
                value={modelId}
                onChange={(event) => setModelId(event.target.value)}
                placeholder={providerId === 'openrouter' ? 'provider/model' : 'model-id'}
                className="text-start text-xs"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void addModel()
                }}
              />
              <Button size="sm" disabled={busy || !modelId.trim()} onClick={() => void addModel()}>
                {providerId === 'openrouter' ? 'افزودن' : 'انتخاب'}
              </Button>
            </div>
          </Field>

          <div
            className={cn(
              'settings-scrollbar flex min-h-0 flex-col gap-1 overflow-y-auto',
              compact ? 'max-h-52 flex-1' : 'max-h-72'
            )}
          >
            {catalog.length > 0 ? (
              catalog.map((model) => (
                <ModelRow
                  key={model.id}
                  model={model}
                  active={snapshot?.modelId === model.id}
                  compact={compact}
                  onSelect={() => void run(() => window.api.llm.setModel(model.id))}
                  onRemove={
                    providerId === 'openrouter' && !model.curated
                      ? () => void run(() => window.api.llm.removeCustomModel(model.id))
                      : undefined
                  }
                />
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[0.68rem] leading-5 text-muted-foreground">
                مدلی پیدا نشد. سرور را روشن کن یا شناسه مدل را بالا وارد کن.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ModelRow({
  model,
  active,
  compact,
  onSelect,
  onRemove
}: {
  model: LlmModelInfo
  active: boolean
  compact: boolean
  onSelect: () => void
  onRemove?: () => void
}): React.JSX.Element {
  return (
    <article
      className={cn(
        'flex items-center gap-2 rounded-lg border px-2.5 text-start transition-colors',
        compact ? 'py-1.5' : 'py-2.5',
        active ? 'border-foreground/30 bg-muted/70' : 'border-transparent hover:bg-muted/40'
      )}
    >
      <button type="button" className="flex min-w-0 flex-1 flex-col gap-0.5" onClick={onSelect}>
        <span className="flex items-center gap-1.5">
          <span className="truncate text-xs font-medium">{model.label}</span>
          {active ? <Badge variant="secondary">فعال</Badge> : null}
        </span>
        {compact ? null : (
          <span className="truncate text-[0.62rem] text-muted-foreground">{model.description}</span>
        )}
      </button>
      {onRemove ? (
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground"
          aria-label="حذف مدل"
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      ) : null}
    </article>
  )
}
