import { ExternalLink, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { LlmSnapshot } from '@/lib/llm'
import { Button } from '@/components/ui/button'

type LlmSettingsProps = {
  snapshot: LlmSnapshot | null
  compact?: boolean
}

export function LlmSettings({ snapshot, compact = false }: LlmSettingsProps): React.JSX.Element {
  const [apiKey, setApiKey] = useState('')
  const [customSlug, setCustomSlug] = useState('')
  const [busy, setBusy] = useState(false)
  const catalog = snapshot?.catalog ?? []
  const activeId = snapshot?.modelId ?? null

  const saveKey = async (): Promise<void> => {
    if (!apiKey.trim()) return
    setBusy(true)
    try {
      await window.api.llm.setApiKey(apiKey.trim())
      setApiKey('')
    } finally {
      setBusy(false)
    }
  }

  const addCustom = async (): Promise<void> => {
    if (!customSlug.trim()) return
    setBusy(true)
    try {
      await window.api.llm.addCustomModel(customSlug.trim())
      setCustomSlug('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={compact ? 'flex h-full min-h-0 flex-col gap-3' : 'flex flex-col gap-4'}>
      <section className="flex shrink-0 flex-col gap-2 rounded-xl border border-border/60 bg-card/30 px-3.5 py-3 text-start">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">کلید OpenRouter</h2>
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            onClick={() => void window.api.llm.openKeys()}
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
            placeholder={snapshot?.hasApiKey ? '••••••••••••' : 'sk-or-…'}
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            className="h-8 min-w-0 flex-1 rounded-lg border border-border/70 bg-background/40 px-2.5 text-start text-xs outline-none focus-visible:border-ring"
          />
          <Button size="sm" disabled={busy || !apiKey.trim()} onClick={() => void saveKey()}>
            ذخیره
          </Button>
          {snapshot?.hasApiKey ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => void window.api.llm.clearApiKey()}
            >
              حذف
            </Button>
          ) : null}
        </div>
        {!snapshot?.encryptionAvailable ? (
          <p className="text-[0.68rem] text-muted-foreground">
            رمزنگاری سیستم در دسترس نیست؛ کلید به‌صورت متن ساده ذخیره می‌شود.
          </p>
        ) : null}
      </section>

      <section className={compact ? 'flex min-h-0 flex-1 flex-col gap-1' : 'flex flex-col gap-2'}>
        {compact ? null : <h2 className="px-0.5 text-sm font-medium">مدل زبانی</h2>}
        <div className={compact ? 'flex min-h-0 flex-col overflow-y-auto' : 'flex flex-col gap-2'}>
          {catalog.map((model) => {
            const active = activeId === model.id
            if (compact) {
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => void window.api.llm.setModel(model.id)}
                  className={
                    active
                      ? 'flex items-center justify-between gap-2 rounded-lg border border-foreground/40 bg-foreground/10 px-3 py-2 text-start'
                      : 'flex items-center justify-between gap-2 rounded-lg border border-transparent px-3 py-2 text-start hover:bg-foreground/5'
                  }
                >
                  <span className="min-w-0 truncate text-sm">{model.label}</span>
                  {active ? (
                    <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-label="فعال" />
                  ) : null}
                </button>
              )
            }
            return (
              <article
                key={model.id}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/30 px-3.5 py-3 text-start"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <h3 className="truncate text-sm font-medium">{model.label}</h3>
                    {active ? (
                      <span
                        className="size-1.5 shrink-0 rounded-full bg-primary"
                        aria-label="فعال"
                      />
                    ) : null}
                  </div>
                  <p className="text-[0.68rem] text-muted-foreground">{model.description}</p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  {active ? null : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void window.api.llm.setModel(model.id)}
                    >
                      انتخاب
                    </Button>
                  )}
                  {!model.curated ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground"
                      onClick={() => void window.api.llm.removeCustomModel(model.id)}
                      aria-label="حذف مدل"
                    >
                      <Trash2 />
                    </Button>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      {compact ? null : (
        <section className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card/30 px-3.5 py-3 text-start">
          <h2 className="text-sm font-medium">مدل سفارشی</h2>
          <p className="text-[0.68rem] text-muted-foreground">
            شناسه OpenRouter را بچسبان، مثلا openai/gpt-4o
          </p>
          <div className="flex items-center gap-1.5">
            <input
              dir="ltr"
              value={customSlug}
              onChange={(event) => setCustomSlug(event.target.value)}
              placeholder="provider/model"
              className="h-8 min-w-0 flex-1 rounded-lg border border-border/70 bg-background/40 px-2.5 text-start text-xs outline-none focus-visible:border-ring"
            />
            <Button
              size="sm"
              disabled={busy || !customSlug.trim()}
              onClick={() => void addCustom()}
            >
              افزودن
            </Button>
          </div>
        </section>
      )}
    </div>
  )
}
