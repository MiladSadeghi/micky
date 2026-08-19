import { ArrowRight, Download, ExternalLink, Trash2, X } from 'lucide-react'
import type { AsrModelView, ModelsSnapshot } from '../../../shared/asr'
import { Button } from '@/components/ui/button'

type SettingsViewProps = {
  snapshot: ModelsSnapshot | null
  sessionActive: boolean
  onBack: () => void
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} گیگابایت`
  return `${Math.round(bytes / 1_000_000)} مگابایت`
}

export function SettingsView({
  snapshot,
  sessionActive,
  onBack
}: SettingsViewProps): React.JSX.Element {
  const models = snapshot?.models ?? []
  const activeModelId = snapshot?.activeModelId ?? null

  return (
    <main className="voice-shell flex min-h-full flex-col overflow-hidden">
      <header className="app-titlebar" aria-hidden="true" />
      <section className="flex items-center gap-2 px-4 pb-4">
        <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="بازگشت">
          <ArrowRight />
        </Button>
        <h1 className="text-sm font-medium">مدل شنوا</h1>
      </section>

      <section className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 pb-6">
        {models.map((model) => (
          <ModelRow
            key={model.id}
            model={model}
            active={activeModelId === model.id}
            sessionActive={sessionActive}
          />
        ))}
      </section>
    </main>
  )
}

function ModelRow({
  model,
  active,
  sessionActive
}: {
  model: AsrModelView
  active: boolean
  sessionActive: boolean
}): React.JSX.Element {
  const progress =
    model.bytes > 0 ? Math.min(100, Math.round((model.bytesDownloaded / model.bytes) * 100)) : 0
  const installed = model.state === 'installed'
  const downloading = model.state === 'downloading'

  return (
    <article className="flex flex-col gap-2.5 rounded-xl border border-border/60 bg-card/30 px-3.5 py-3 text-start">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate text-sm font-medium">{model.label}</h2>
            {active && installed ? (
              <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-label="فعال" />
            ) : null}
          </div>
          <p className="text-[0.68rem] text-muted-foreground">
            {model.description} · {formatBytes(model.bytes)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {downloading ? (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              onClick={() => void window.api.models.cancel(model.id)}
              aria-label="لغو دانلود"
            >
              <X />
            </Button>
          ) : installed ? (
            <>
              {active ? null : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void window.api.models.setActive(model.id)}
                >
                  انتخاب
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground"
                disabled={sessionActive && active}
                onClick={() => void window.api.models.remove(model.id)}
                aria-label="حذف مدل"
              >
                <Trash2 />
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => void window.api.models.download(model.id)}>
              <Download data-icon="inline-start" />
              {model.state === 'error' ? 'تلاش دوباره' : 'دانلود'}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            onClick={() => void window.api.models.openCard(model.cardUrl)}
            aria-label="صفحه مدل"
          >
            <ExternalLink />
          </Button>
        </div>
      </div>

      {downloading ? (
        <div className="flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[0.65rem] tabular-nums text-muted-foreground">{progress}٪</span>
        </div>
      ) : null}

      {model.error ? <p className="text-[0.7rem] text-destructive">{model.error}</p> : null}
    </article>
  )
}
