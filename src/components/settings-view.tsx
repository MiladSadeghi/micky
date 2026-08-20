import {
  ArrowRight,
  BrainCircuit,
  CircleHelp,
  Download,
  Ear,
  ExternalLink,
  Keyboard,
  Mic,
  Sparkles,
  Trash2,
  Volume2,
  X
} from 'lucide-react'
import { useState } from 'react'
import type { AsrModelView, ModelsSnapshot } from '@/lib/asr'
import type { TtsSnapshot } from '@/lib/tts'
import type { SettingsSnapshot } from '@/lib/settings'
import type { LlmSnapshot } from '@/lib/llm'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LlmSettings } from '@/components/llm-settings'
import { MickyLogo } from '@/components/micky-logo'
import { PersonalitySettings } from '@/components/personality-settings'
import { TtsSettings } from '@/components/tts-settings'
import { useLlm } from '@/hooks/use-llm'
import { useSettings } from '@/hooks/use-settings'
import { useSoul } from '@/hooks/use-soul'

type SettingsTab = 'asr' | 'llm' | 'tts' | 'soul' | 'shortcuts' | 'about'

const TAB_COPY: Record<SettingsTab, { title: string; description: string }> = {
  asr: { title: 'شنیدن', description: 'مدل محلی تبدیل صدای تو به متن' },
  llm: {
    title: 'مدل زبانی',
    description: 'مدلی که فکر می‌کند، ابزار به کار می‌گیرد و جواب می‌دهد'
  },
  tts: { title: 'صدای میکی', description: 'سرویس و صدایی که جواب‌ها را می‌خواند' },
  soul: { title: 'آشنایی', description: 'شخصیت میکی و چیزهایی که از تو به یاد دارد' },
  shortcuts: {
    title: 'میانبرها',
    description: 'دستیار و دیکته را از هر برنامه‌ای سریع صدا بزن'
  },
  about: {
    title: 'میکی چطور کار می‌کند؟',
    description: 'از شنیدن صدای تو تا انجام کار و جواب‌دادن'
  }
}

const SETTINGS_TABS = [
  { id: 'asr', label: 'شنیدن', icon: Ear },
  { id: 'llm', label: 'مدل', icon: BrainCircuit },
  { id: 'tts', label: 'صدا', icon: Volume2 },
  { id: 'soul', label: 'شخصیت', icon: Sparkles },
  { id: 'shortcuts', label: 'میانبرها', icon: Keyboard },
  { id: 'about', label: 'روش کار', icon: CircleHelp }
] satisfies ReadonlyArray<{ id: SettingsTab; label: string; icon: typeof Ear }>

const HOW_MICKY_WORKS = [
  {
    title: 'صدایت را می‌شنود',
    description:
      'با «هی میکی»، لمس گوی یا میانبر بیدار می‌شود و صدایت را محلی به متن تبدیل می‌کند.',
    icon: Mic
  },
  {
    title: 'فکر می‌کند و انجام می‌دهد',
    description: 'مدل زبانی درخواستت را می‌فهمد و در صورت نیاز ابزار مناسب را به کار می‌گیرد.',
    icon: BrainCircuit
  },
  {
    title: 'جواب می‌دهد و منتظر می‌ماند',
    description: 'جواب کوتاه را با صدا می‌گوید و چند ثانیه برای ادامه گفتگو گوش می‌دهد.',
    icon: Volume2
  }
] as const

type SettingsViewProps = {
  snapshot: ModelsSnapshot | null
  ttsSnapshot: TtsSnapshot | null
  sessionActive: boolean
  onBack: () => void
}

export function SettingsView({
  snapshot,
  ttsSnapshot,
  sessionActive,
  onBack
}: SettingsViewProps): React.JSX.Element {
  const [tab, setTab] = useState<SettingsTab>('asr')
  const llm = useLlm()
  const soul = useSoul()
  const settings = useSettings()

  return (
    <main className="voice-shell flex h-full min-h-0 flex-col overflow-hidden">
      <header className="app-titlebar flex shrink-0 items-center justify-center" aria-hidden="true">
        <MickyLogo className="size-5 opacity-55" />
      </header>
      <section className="flex shrink-0 items-center gap-2 px-4 pb-3">
        <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="بازگشت">
          <ArrowRight />
        </Button>
        <div className="flex min-w-0 flex-col">
          <h1 className="text-sm font-medium">تنظیمات</h1>
          <p className="text-[0.65rem] text-muted-foreground">همه‌چیز برای شنیدن و جواب‌دادن</p>
        </div>
      </section>

      <Tabs
        value={tab}
        orientation="vertical"
        onValueChange={(value) => setTab(value as SettingsTab)}
        className="min-h-0 flex-1 gap-0 overflow-hidden border-t border-border/40"
      >
        <TabsList
          className="h-full w-44 shrink-0 items-stretch justify-start rounded-none border-l border-border/50 bg-card/30 p-3"
          aria-label="بخش‌های تنظیمات"
        >
          {SETTINGS_TABS.map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id} className="h-10 flex-none px-3">
              <Icon data-icon="inline-start" aria-hidden="true" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <SettingsTabPanel tab="asr">
          <div className="flex flex-col gap-2">
            {(snapshot?.models ?? []).map((model) => (
              <ModelRow
                key={model.id}
                model={model}
                active={(snapshot?.activeModelId ?? null) === model.id}
                sessionActive={sessionActive}
              />
            ))}
          </div>
        </SettingsTabPanel>

        <SettingsTabPanel tab="llm">
          <LlmSettings snapshot={llm} />
          {settings && llm ? <VisionModelSetting settings={settings} llm={llm} /> : null}
        </SettingsTabPanel>

        <SettingsTabPanel tab="tts">
          <TtsSettings snapshot={ttsSnapshot} />
        </SettingsTabPanel>

        <SettingsTabPanel tab="soul">
          <PersonalitySettings snapshot={soul} />
        </SettingsTabPanel>

        <SettingsTabPanel tab="shortcuts">
          {settings ? <ShortcutSettings settings={settings} /> : null}
        </SettingsTabPanel>

        <SettingsTabPanel tab="about">
          <HowMickyWorks />
          <SystemToolsSetting enabled={settings?.systemToolsEnabled !== false} />
        </SettingsTabPanel>
      </Tabs>
    </main>
  )
}

function SettingsTabPanel({
  tab,
  children
}: {
  tab: SettingsTab
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <TabsContent
      value={tab}
      className="settings-scrollbar min-h-0 min-w-0 overflow-y-auto overscroll-contain px-6 pb-8"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pt-4">
        <TabIntro tab={tab} />
        {children}
      </div>
    </TabsContent>
  )
}

function ShortcutSettings({ settings }: { settings: SettingsSnapshot }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <Card size="sm" className="bg-card/30">
        <CardHeader>
          <CardTitle>فراخوانی سریع</CardTitle>
          <CardDescription>روی هر کادر بزن و ترکیب کلید تازه را فشار بده</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="gap-3">
            <ShortcutField
              id="assistant-shortcut"
              label="دستیار"
              value={settings.assistantShortcut}
              onChange={(value) => window.api.settings.setShortcut('assistant', value)}
            />
            <ShortcutField
              id="dictation-shortcut"
              label="دیکته"
              value={settings.dictationShortcut}
              onChange={(value) => window.api.settings.setShortcut('dictation', value)}
            />
            {settings.shortcutError ? (
              <FieldDescription className="text-destructive">
                {settings.shortcutError}
              </FieldDescription>
            ) : null}
          </FieldGroup>
        </CardContent>
      </Card>

      <Card size="sm" className="bg-card/30">
        <CardHeader>
          <CardTitle>رفتار پس‌زمینه</CardTitle>
          <CardDescription>دیکته و آماده‌بودن میکی را تنظیم کن</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="gap-4">
            <SettingToggle
              id="dictation-ai-cleanup"
              label="تمیزکردن متن با هوش مصنوعی"
              description="متن دیکته را پیش از چسباندن روان‌تر می‌کند"
              enabled={settings.dictationAiCleanup}
              onChange={(enabled) => window.api.settings.setDictationAiCleanup(enabled)}
            />
            <SettingToggle
              id="dictation-auto-paste"
              label="چسباندن خودکار متن"
              description="خروجی را مستقیم در برنامه فعال می‌چسباند"
              enabled={settings.dictationAutoPaste}
              onChange={(enabled) => window.api.settings.setDictationAutoPaste(enabled)}
            />
            <SettingToggle
              id="launch-at-login"
              label="اجرای میکی هنگام ورود"
              description="پس از ورود به سیستم، میکی در پس‌زمینه آماده می‌ماند"
              enabled={settings.launchAtLogin}
              onChange={(enabled) => window.api.settings.setLaunchAtLogin(enabled)}
            />
          </FieldGroup>
        </CardContent>
      </Card>
    </div>
  )
}

function ShortcutField({
  id,
  label,
  value,
  onChange
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => Promise<SettingsSnapshot>
}): React.JSX.Element {
  const [recording, setRecording] = useState(false)
  return (
    <Field orientation="horizontal">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        className="w-52 text-left font-mono text-[0.62rem]"
        dir="ltr"
        readOnly
        value={recording ? 'Press shortcut…' : value}
        onFocus={() => setRecording(true)}
        onBlur={() => setRecording(false)}
        onKeyDown={(event) => {
          event.preventDefault()
          const accelerator = toAccelerator(event)
          if (!accelerator) return
          setRecording(false)
          event.currentTarget.blur()
          void onChange(accelerator)
        }}
      />
    </Field>
  )
}

function SettingToggle({
  id,
  label,
  description,
  enabled,
  onChange
}: {
  id: string
  label: string
  description: string
  enabled: boolean
  onChange: (enabled: boolean) => Promise<SettingsSnapshot>
}): React.JSX.Element {
  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <FieldDescription className="text-[0.68rem] leading-5">{description}</FieldDescription>
      </FieldContent>
      <Switch
        id={id}
        dir="ltr"
        checked={enabled}
        onCheckedChange={(checked) => void onChange(checked)}
      />
    </Field>
  )
}

function VisionModelSetting({
  settings,
  llm
}: {
  settings: SettingsSnapshot
  llm: LlmSnapshot
}): React.JSX.Element {
  const models = llm.catalog.filter((model) => model.inputModalities.includes('image'))
  if (models.length === 0) return <></>
  return (
    <article className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card/30 px-3.5 py-3 text-start">
      <h2 className="text-sm font-medium">مدل دیدن صفحه</h2>
      <p className="text-[0.68rem] leading-5 text-muted-foreground">
        وقتی مدل اصلی تصویر نمی‌پذیرد، میکی از این مدل استفاده می‌کند
      </p>
      <select
        className="h-9 rounded-lg border border-input bg-background px-2 text-xs"
        value={settings.visionModelId}
        onChange={(event) => void window.api.settings.setVisionModel(event.target.value)}
      >
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.label}
          </option>
        ))}
      </select>
    </article>
  )
}

function toAccelerator(event: React.KeyboardEvent<HTMLInputElement>): string | null {
  if (['Control', 'Meta', 'Shift', 'Alt'].includes(event.key)) return null
  if (!event.ctrlKey && !event.metaKey && !event.altKey) return null
  const modifiers = [
    event.ctrlKey || event.metaKey ? 'CommandOrControl' : null,
    event.altKey ? 'Alt' : null,
    event.shiftKey ? 'Shift' : null
  ].filter(Boolean)
  const key =
    event.code === 'Space' ? 'Space' : event.key.length === 1 ? event.key.toUpperCase() : event.key
  return [...modifiers, key].join('+')
}

function HowMickyWorks(): React.JSX.Element {
  return (
    <Card size="sm" className="bg-card/30">
      <CardHeader>
        <CardTitle>یک چرخه ساده</CardTitle>
        <CardDescription>بدون صفحه چت یا فهرست گفتگو؛ فقط بگو و برگرد سر کارت</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-4">
          {HOW_MICKY_WORKS.map(({ title, description, icon: Icon }, index) => (
            <li key={title} className="flex items-start gap-3 text-start">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <h3 className="text-sm font-medium">
                  <span className="sr-only">مرحله {index + 1}: </span>
                  {title}
                </h3>
                <p className="text-[0.68rem] leading-5 text-muted-foreground">{description}</p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}

function SystemToolsSetting({ enabled }: { enabled: boolean }): React.JSX.Element {
  return (
    <Card size="sm" className="bg-card/30">
      <CardHeader>
        <CardTitle id="system-tools-label">دسترسی به فایل‌ها و دستورها</CardTitle>
        <CardDescription>
          خواندن فایل، جستجو، بازکردن برنامه و اجرای دستور؛ کارهای حساس همیشه تأیید می‌خواهند
        </CardDescription>
        <CardAction>
          <Switch
            dir="ltr"
            checked={enabled}
            aria-labelledby="system-tools-label"
            onCheckedChange={(checked) => void window.api.settings.setSystemToolsEnabled(checked)}
          />
        </CardAction>
      </CardHeader>
    </Card>
  )
}

function TabIntro({ tab }: { tab: SettingsTab }): React.JSX.Element {
  return (
    <header className="flex flex-col gap-0.5 px-0.5 text-start">
      <h2 className="text-[0.95rem] font-medium tracking-[-0.02em]">{TAB_COPY[tab].title}</h2>
      <p className="text-[0.7rem] leading-5 text-muted-foreground">{TAB_COPY[tab].description}</p>
    </header>
  )
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} گیگابایت`
  return `${Math.round(bytes / 1_000_000)} مگابایت`
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
