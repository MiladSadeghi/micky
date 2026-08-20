import { ExternalLink, RefreshCw, Volume2 } from 'lucide-react'
import { useState } from 'react'
import type { TtsProviderId, TtsSnapshot } from '@/lib/tts'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'

export function TtsSettings({ snapshot }: { snapshot: TtsSnapshot | null }): React.JSX.Element {
  const [apiKey, setApiKey] = useState('')
  const [manualVoiceId, setManualVoiceId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const providerId = snapshot?.providerId ?? 'gemini'
  const hasKey = providerId === 'gemini' ? snapshot?.hasGeminiApiKey : snapshot?.hasElevenLabsApiKey
  const voices =
    providerId === 'gemini' ? (snapshot?.geminiVoices ?? []) : (snapshot?.elevenLabsVoices ?? [])
  const activeVoice = providerId === 'gemini' ? snapshot?.geminiVoice : snapshot?.elevenLabsVoiceId

  const run = async (action: () => Promise<unknown>): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'این تغییر ذخیره نشد.')
    } finally {
      setBusy(false)
    }
  }

  const selectProvider = (next: TtsProviderId): void => {
    setApiKey('')
    setManualVoiceId('')
    void run(() => window.api.tts.setProvider(next))
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/30 px-3.5 py-3 text-start">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="tts-enabled-label" className="text-sm font-medium">
            صدای میکی
          </h2>
          <p className="text-[0.68rem] leading-5 text-muted-foreground">
            جواب‌ها بعد از ساخته‌شدن با صدا پخش می‌شوند
          </p>
        </div>
        <Switch
          dir="ltr"
          checked={snapshot?.enabled !== false}
          disabled={busy}
          aria-labelledby="tts-enabled-label"
          onCheckedChange={(checked) => void run(() => window.api.tts.setEnabled(checked))}
        />
      </section>

      <section className="flex flex-col gap-2 text-start">
        <h2 className="px-0.5 text-sm font-medium">سرویس صدا</h2>
        <div className="grid grid-cols-2 gap-2">
          <ProviderButton
            active={providerId === 'gemini'}
            title="Gemini Flash 2.5"
            subtitle="سریع و گرم"
            onClick={() => selectProvider('gemini')}
          />
          <ProviderButton
            active={providerId === 'elevenlabs'}
            title="ElevenLabs v3"
            subtitle="بیان طبیعی‌تر"
            onClick={() => selectProvider('elevenlabs')}
          />
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card/30 px-3.5 py-3 text-start">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">
            کلید {providerId === 'gemini' ? 'Gemini' : 'ElevenLabs'}
          </h2>
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            onClick={() => void window.api.tts.openKeys(providerId)}
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
            placeholder={hasKey ? '••••••••••••' : providerId === 'gemini' ? 'AIza…' : 'sk_…'}
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            className="h-8 min-w-0 flex-1 rounded-lg border border-border/70 bg-background/40 px-2.5 text-start text-xs outline-none focus-visible:border-ring"
          />
          <Button
            size="sm"
            disabled={busy || !apiKey.trim() || snapshot?.keychainAvailable === false}
            onClick={() =>
              void run(async () => {
                await window.api.tts.setApiKey(providerId, apiKey.trim())
                setApiKey('')
              })
            }
          >
            ذخیره
          </Button>
          {hasKey ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => void run(() => window.api.tts.clearApiKey(providerId))}
            >
              حذف
            </Button>
          ) : null}
        </div>
        {snapshot?.keychainAvailable === false ? (
          <p className="text-[0.68rem] text-muted-foreground">کی‌چین سیستم در دسترس نیست.</p>
        ) : null}
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card/30 px-3.5 py-3 text-start">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">صدا</h2>
          {providerId === 'elevenlabs' && hasKey ? (
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground"
              disabled={busy}
              onClick={() => void run(() => window.api.tts.refreshVoices())}
              aria-label="به‌روزرسانی صداها"
            >
              <RefreshCw />
            </Button>
          ) : null}
        </div>
        {voices.length > 0 ? (
          <select
            dir="ltr"
            value={activeVoice || ''}
            onChange={(event) =>
              void run(() => window.api.tts.setVoice(providerId, event.target.value))
            }
            className="h-9 rounded-lg border border-border/70 bg-background/60 px-2.5 text-xs outline-none focus-visible:border-ring"
          >
            {providerId === 'elevenlabs' && !activeVoice ? (
              <option value="" disabled>
                یک صدا انتخاب کن
              </option>
            ) : null}
            {voices.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.label}
                {voice.description ? ` — ${voice.description}` : ''}
              </option>
            ))}
          </select>
        ) : providerId === 'elevenlabs' ? (
          <div className="flex items-center gap-1.5">
            <input
              dir="ltr"
              value={manualVoiceId}
              onChange={(event) => setManualVoiceId(event.target.value)}
              placeholder="ElevenLabs voice ID"
              className="h-8 min-w-0 flex-1 rounded-lg border border-border/70 bg-background/40 px-2.5 text-start text-xs outline-none focus-visible:border-ring"
            />
            <Button
              size="sm"
              disabled={busy || !manualVoiceId.trim()}
              onClick={() =>
                void run(() => window.api.tts.setVoice('elevenlabs', manualVoiceId.trim()))
              }
            >
              انتخاب
            </Button>
          </div>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          disabled={busy || !snapshot?.configured}
          onClick={() => void run(() => window.api.tts.preview())}
        >
          <Volume2 data-icon="inline-start" />
          شنیدن نمونه
        </Button>
      </section>

      {error || snapshot?.error ? (
        <p className="px-0.5 text-[0.7rem] leading-5 text-destructive">
          {error ?? snapshot?.error}
        </p>
      ) : null}
    </div>
  )
}

function ProviderButton({
  active,
  title,
  subtitle,
  onClick
}: {
  active: boolean
  title: string
  subtitle: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'flex flex-col gap-0.5 rounded-xl border border-foreground/40 bg-foreground/10 px-3 py-2.5 text-start'
          : 'flex flex-col gap-0.5 rounded-xl border border-border/60 bg-card/30 px-3 py-2.5 text-start hover:bg-foreground/5'
      }
    >
      <span className="text-xs font-medium" dir="ltr">
        {title}
      </span>
      <span className="text-[0.65rem] text-muted-foreground">{subtitle}</span>
    </button>
  )
}
