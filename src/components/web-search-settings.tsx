import { ExternalLink, Globe2 } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { FieldError } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import type {
  WebSearchApiProviderId,
  WebSearchProviderId,
  WebSearchProviderSnapshot,
  WebSearchSnapshot
} from '@/lib/web-search'

type ProviderCopy = {
  title: string
  description: string
  keyPlaceholder?: string
  keyOptional?: boolean
}

const PROVIDER_COPY: Record<WebSearchProviderId, ProviderCopy> = {
  exa: {
    title: 'Exa',
    description: 'جستجوی سریع و مناسب پرسش‌های تازه؛ برای روشن‌شدن به کلید API نیاز دارد',
    keyPlaceholder: 'exa-…'
  },
  firecrawl: {
    title: 'Firecrawl',
    description: 'فقط نتیجه، نشانی و خلاصهٔ جستجو را می‌گیرد؛ محتوای صفحه دریافت نمی‌شود',
    keyPlaceholder: 'fc-…',
    keyOptional: true
  },
  google: {
    title: 'Google محلی',
    description:
      'جستجوی ناشناس از IP عمومی همین کامپیوتر؛ ممکن است با کپچا یا تغییر صفحه از کار بیفتد'
  }
}

export function WebSearchSettings({
  snapshot
}: {
  snapshot: WebSearchSnapshot | null
}): React.JSX.Element {
  const [keys, setKeys] = useState<Record<WebSearchApiProviderId, string>>({
    exa: '',
    firecrawl: ''
  })
  const [busyProvider, setBusyProvider] = useState<WebSearchProviderId | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (
    provider: WebSearchProviderId,
    action: () => Promise<unknown>
  ): Promise<void> => {
    if (busyProvider) return
    setBusyProvider(provider)
    setError(null)
    try {
      await action()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'این تغییر ذخیره نشد.')
    } finally {
      setBusyProvider(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Card size="sm" className="bg-card/30">
        <CardHeader>
          <CardTitle>ابزار جستجوی وب</CardTitle>
          <CardDescription>
            {snapshot?.toolAvailable
              ? 'حداقل یک سرویس آماده است و میکی می‌تواند وب را جستجو کند'
              : 'خاموش است؛ تا یک سرویس را روشن نکنی، ابزار جستجو وارد زمان اجرای میکی نمی‌شود'}
          </CardDescription>
          <CardAction>
            <Badge variant="secondary">{snapshot?.toolAvailable ? 'آماده' : 'خاموش'}</Badge>
          </CardAction>
        </CardHeader>
      </Card>

      {snapshot?.providers.map((provider) => (
        <ProviderCard
          key={provider.id}
          provider={provider}
          snapshot={snapshot}
          apiKey={provider.id === 'google' ? '' : keys[provider.id]}
          busy={busyProvider === provider.id}
          onApiKeyChange={(value) => {
            if (provider.id !== 'google')
              setKeys((current) => ({ ...current, [provider.id]: value }))
          }}
          onToggle={(enabled) =>
            run(provider.id, () => window.api.webSearch.setProviderEnabled(provider.id, enabled))
          }
          onSaveKey={() => {
            const providerId = provider.id
            if (providerId === 'google') return
            const apiKey = keys[providerId].trim()
            void run(providerId, async () => {
              await window.api.webSearch.setApiKey(providerId, apiKey)
              setKeys((current) => ({ ...current, [providerId]: '' }))
            })
          }}
          onClearKey={() => {
            const providerId = provider.id
            if (providerId !== 'google') {
              void run(providerId, () => window.api.webSearch.clearApiKey(providerId))
            }
          }}
        />
      ))}

      {error ? <FieldError className="px-1 text-xs">{error}</FieldError> : null}
      {snapshot?.keychainAvailable === false ? (
        <p className="px-1 text-[0.68rem] leading-5 text-muted-foreground">
          کی‌چین سیستم در دسترس نیست؛ Google و حالت بدون کلید Firecrawl همچنان قابل استفاده‌اند.
        </p>
      ) : null}
    </div>
  )
}

function ProviderCard({
  provider,
  snapshot,
  apiKey,
  busy,
  onApiKeyChange,
  onToggle,
  onSaveKey,
  onClearKey
}: {
  provider: WebSearchProviderSnapshot
  snapshot: WebSearchSnapshot
  apiKey: string
  busy: boolean
  onApiKeyChange: (value: string) => void
  onToggle: (enabled: boolean) => void
  onSaveKey: () => void
  onClearKey: () => void
}): React.JSX.Element {
  const copy = PROVIDER_COPY[provider.id]
  const apiProvider = provider.id === 'google' ? null : provider.id
  const canEnable = !provider.requiresApiKey || provider.hasApiKey

  return (
    <Card size="sm" className="bg-card/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe2 className="size-4 text-muted-foreground" aria-hidden="true" />
          {copy.title}
          {provider.experimental ? (
            <Badge variant="secondary" className="text-[0.58rem]">
              آزمایشی
            </Badge>
          ) : null}
        </CardTitle>
        <CardDescription>{copy.description}</CardDescription>
        <CardAction>
          <Switch
            dir="ltr"
            checked={provider.enabled}
            disabled={busy || !canEnable}
            aria-label={`فعال‌کردن ${copy.title}`}
            onCheckedChange={onToggle}
          />
        </CardAction>
      </CardHeader>

      {apiProvider ? (
        <CardContent className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[0.68rem] text-muted-foreground">
              {provider.hasApiKey
                ? 'کلید API ذخیره شده'
                : copy.keyOptional
                  ? 'کلید API اختیاری است و سقف استفاده را بیشتر می‌کند'
                  : 'برای روشن‌کردن، کلید API را وصل کن'}
            </p>
            <Button
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              onClick={() => void window.api.webSearch.openKeys(apiProvider)}
            >
              گرفتن کلید
              <ExternalLink data-icon="inline-end" />
            </Button>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="password"
              dir="ltr"
              autoComplete="off"
              placeholder={provider.hasApiKey ? '••••••••••••' : copy.keyPlaceholder}
              value={apiKey}
              disabled={busy || snapshot.keychainAvailable === false}
              onChange={(event) => onApiKeyChange(event.target.value)}
              className="h-8 min-w-0 flex-1 rounded-lg border border-border/70 bg-background/40 px-2.5 text-start text-xs outline-none focus-visible:border-ring"
            />
            <Button
              size="sm"
              disabled={busy || !apiKey.trim() || snapshot.keychainAvailable === false}
              onClick={onSaveKey}
            >
              ذخیره
            </Button>
            {provider.hasApiKey ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                disabled={busy}
                onClick={onClearKey}
              >
                حذف
              </Button>
            ) : null}
          </div>
        </CardContent>
      ) : null}
    </Card>
  )
}
