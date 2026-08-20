import {
  BrainCircuit,
  Check,
  Database,
  Download,
  Ear,
  Keyboard,
  MicOff,
  MousePointer2,
  Volume2,
  X,
  type LucideIcon
} from 'lucide-react'
import { useState } from 'react'
import type { AsrModelView, ModelsSnapshot } from '@/lib/asr'
import {
  EMPTY_USER_PROFILE,
  parseUserProfileDraft,
  type AddressForm,
  type LanguageMix,
  type ReplyLength,
  type UserProfileDraft
} from '@/lib/soul'
import type { TtsSnapshot } from '@/lib/tts'
import { Button } from '@/components/ui/button'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { LlmSettings } from '@/components/llm-settings'
import { MickyLogo } from '@/components/micky-logo'
import { ShenavaModelHelp } from '@/components/shenava-model-help'
import { useLlm } from '@/hooks/use-llm'
import { useSettings } from '@/hooks/use-settings'
import { DEFAULT_ASSISTANT_SHORTCUT, DEFAULT_WAKE_WORD_SHORTCUT } from '@/lib/settings'
import { shortcutDisplayKeys } from '@/lib/shortcuts'
import { cn } from '@/lib/utils'

type Step = 0 | 1 | 2 | 3 | 4 | 5

const SETUP_STEPS = 5

type OnboardingViewProps = {
  models: ModelsSnapshot | null
  ttsSnapshot: TtsSnapshot | null
  existingUserMarkdown: string
}

export function OnboardingView({
  models,
  ttsSnapshot,
  existingUserMarkdown
}: OnboardingViewProps): React.JSX.Element {
  const llm = useLlm()
  const settings = useSettings()
  const [step, setStep] = useState<Step>(0)
  const [draft, setDraft] = useState<UserProfileDraft>(() =>
    existingUserMarkdown ? parseUserProfileDraft(existingUserMarkdown) : { ...EMPTY_USER_PROFILE }
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const patch = (update: Partial<UserProfileDraft>): void => {
    setDraft((current) => ({ ...current, ...update }))
  }

  const finish = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await window.api.soul.completeOnboarding(draft)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'راه‌اندازی ذخیره نشد. دوباره تلاش کن.')
    } finally {
      setBusy(false)
    }
  }

  const skip = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await window.api.soul.dismissOnboarding()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'فعلاً نمی‌شه از راه‌اندازی خارج شد.')
    } finally {
      setBusy(false)
    }
  }

  const installedModel = models?.models.some((model) => model.state === 'installed') ?? false
  const llmReady = llm?.configured === true && !llm.error
  const ttsReady = ttsSnapshot?.enabled !== false && ttsSnapshot?.configured === true

  return (
    <main className="voice-shell flex h-full min-h-0 flex-col overflow-hidden">
      <header className="app-titlebar flex shrink-0 items-center justify-center" aria-hidden="true">
        <MickyLogo className="size-5 opacity-55" />
      </header>

      {step > 0 ? (
        <div className="flex shrink-0 items-center gap-1.5 px-5 pb-3" aria-hidden="true">
          {Array.from({ length: SETUP_STEPS }, (_, index) => (
            <span
              key={index}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                index < step ? 'bg-foreground/80' : 'bg-foreground/15'
              )}
            />
          ))}
        </div>
      ) : (
        <div className="h-3 shrink-0" />
      )}

      <section className="settings-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-3">
        {step === 0 ? <Welcome onStart={() => setStep(1)} /> : null}

        {step === 1 ? (
          <StepBody
            eyebrow="اول ببین چطور کار می‌کنم"
            title="من ۴ بخش ساده دارم"
            description="هر بخش یه کار انجام می‌ده و هر کدوم رو هر وقت بخوای می‌تونی عوض کنی."
          >
            <div className="grid grid-cols-2 gap-2">
              <BuildingBlock
                icon={Ear}
                title="شنیدن"
                description="صدات رو همین‌جا روی دستگاه به متن تبدیل می‌کنم"
                status={installedModel ? 'آماده' : 'باید دانلود بشه'}
                ready={installedModel}
              />
              <BuildingBlock
                icon={BrainCircuit}
                title="مدل زبانی"
                description="منظورت رو می‌فهمم و جواب رو آماده می‌کنم"
                status={llmReady ? 'آماده' : 'آماده نیست'}
                ready={llmReady}
              />
              <BuildingBlock
                icon={Volume2}
                title="پاسخ صوتی"
                description="اگه بخوای، جوابم رو با صدا برات می‌خونم"
                status={ttsReady ? 'آماده' : 'اختیاری'}
                ready={ttsReady}
              />
              <BuildingBlock
                icon={Database}
                title="اطلاعات محلی"
                description="پروفایل و گفت‌وگوهات رو روی دستگاه نگه می‌دارم"
                status="روی دستگاه"
                ready
              />
            </div>
            <p className="rounded-lg bg-foreground/5 px-3 py-2 text-[0.68rem] leading-5 text-muted-foreground">
              حالا فقط مدل شنیدن و مدل زبانی رو آماده می‌کنیم. صدا اختیاریه و هر وقت بخوای می‌تونی
              روشنش کنی.
            </p>
          </StepBody>
        ) : null}

        {step === 2 ? (
          <StepBody
            eyebrow="اول گوش‌هام رو آماده کنیم"
            title="مدل شنیدن رو انتخاب کن"
            description="این مدل صدات رو همین‌جا روی دستگاه به متن تبدیل می‌کنه. فقط یه بار دانلودش کن؛ بعدش بدون اینترنت هم صدات رو می‌شنوم."
            topAligned
          >
            <div className="flex flex-col gap-2">
              {(models?.models ?? []).map((model) => (
                <SpeechModel
                  key={model.id}
                  model={model}
                  active={models?.activeModelId === model.id}
                />
              ))}
              {!models ? (
                <p className="rounded-xl border border-dashed border-border/60 px-3 py-5 text-center text-xs text-muted-foreground">
                  یه لحظه، دارم مدل‌های شنیدن رو پیدا می‌کنم…
                </p>
              ) : null}
              <ShenavaModelHelp />
            </div>
          </StepBody>
        ) : null}

        {step === 3 ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2.5 text-start">
            <StepHeading
              eyebrow="حالا مدل زبانی رو انتخاب کن"
              title="با کدوم مدل جواب بدم؟"
              description="مدل زبانی درخواستت رو می‌فهمه و جواب رو می‌سازه. یه مدل ابری یا محلی انتخاب کن؛ بعداً هم هر وقت بخوای می‌تونی عوضش کنی."
            />
            <div className="flex min-h-0 flex-1 flex-col">
              <LlmSettings snapshot={llm} compact />
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <StepBody
            eyebrow="آخرین مرحله"
            title="دوست داری چطور باهات حرف بزنم؟"
            description="لازم نیست اسمت رو بگی. فقط بگو «تو» بگم یا «شما» و جواب‌هام چه شکلی باشن."
          >
            <Field label="اسمت، اگه دوست داری">
              <TextField
                value={draft.name}
                placeholder="مثلاً مانی"
                autoFocus
                onChange={(name) => patch({ name })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="تو یا شما؟">
                <Choice
                  options={[
                    { id: 'to', label: 'تو' },
                    { id: 'shoma', label: 'شما' }
                  ]}
                  value={draft.addressForm}
                  onSelect={(addressForm: AddressForm) => patch({ addressForm })}
                />
              </Field>
              <Field label="جواب‌هام چقدر بلند باشن؟">
                <Choice
                  options={[
                    { id: 'short', label: 'کوتاه و مستقیم' },
                    { id: 'medium', label: 'با یه کم توضیح' }
                  ]}
                  value={draft.replyLength}
                  onSelect={(replyLength: ReplyLength) => patch({ replyLength })}
                />
              </Field>
            </div>
            <Field label="زبان جواب‌هام">
              <Choice
                horizontal
                options={[
                  { id: 'mixed', label: 'فارسی، با کلمه‌های انگلیسی هرجا لازم شد' },
                  { id: 'persian', label: 'فقط فارسی' }
                ]}
                value={draft.languageMix}
                onSelect={(languageMix: LanguageMix) => patch({ languageMix })}
              />
            </Field>
          </StepBody>
        ) : null}

        {step === 5 ? (
          <ReadyStep
            name={draft.name}
            assistantShortcut={settings?.assistantShortcut ?? DEFAULT_ASSISTANT_SHORTCUT}
            wakeWordShortcut={settings?.wakeWordShortcut ?? DEFAULT_WAKE_WORD_SHORTCUT}
          />
        ) : null}
      </section>

      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-border/40 px-5 pt-3 pb-4">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          disabled={busy}
          onClick={() => void skip()}
        >
          بعداً تنظیمش می‌کنم
        </Button>
        <div className="flex items-center gap-1.5">
          {step > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setStep((step - 1) as Step)}
            >
              قبلی
            </Button>
          ) : null}
          {step > 0 && step < 5 ? (
            <Button size="sm" onClick={() => setStep((step + 1) as Step)}>
              ادامه
            </Button>
          ) : step === 5 ? (
            <Button size="sm" disabled={busy} onClick={() => void finish()}>
              شروع کنیم
            </Button>
          ) : null}
        </div>
        {error ? (
          <p className="absolute right-5 bottom-16 left-5 rounded-lg bg-destructive/15 px-3 py-2 text-center text-[0.68rem] text-destructive">
            {error}
          </p>
        ) : null}
      </footer>
    </main>
  )
}

function Welcome({ onStart }: { onStart: () => void }): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col justify-center gap-7 text-start">
      <div className="flex flex-col gap-3">
        <MickyLogo className="mb-2 size-16 drop-shadow-[0_10px_24px_rgba(0,0,0,0.28)]" />
        <p className="text-[0.7rem] tracking-[0.12em] text-muted-foreground">میکی</p>
        <h1 className="text-[1.55rem] leading-9 font-medium tracking-[-0.045em]">
          سلام، من میکی‌ام.
        </h1>
        <p className="max-w-[19rem] text-[0.9rem] leading-7 text-muted-foreground">
          قراره دستیار فارسی جدیدت باشم. می‌تونی باهام حرف بزنی، سؤال بپرسی یا ازم بخوای کاری برات
          انجام بدم.
        </p>
        <p className="max-w-[19rem] text-[0.78rem] leading-6 text-muted-foreground">
          اول یه راه‌اندازی کوتاه داریم تا مدل‌ها و لحن جواب‌هام رو برای خودت تنظیم کنی.
        </p>
      </div>
      <div className="flex flex-col gap-2 text-[0.72rem] text-muted-foreground">
        <WelcomeHint icon={Ear}>برای بیدار کردنم بگو «هی میکی» یا «میکی»</WelcomeHint>
        <WelcomeHint icon={MousePointer2}>یا روی گوی بزن و شروع کن</WelcomeHint>
        <WelcomeHint icon={Keyboard}>از هر برنامه‌ای هم با میانبر باز می‌شم</WelcomeHint>
      </div>
      <Button className="self-start" onClick={onStart}>
        راه‌اندازی رو شروع کنیم
      </Button>
    </div>
  )
}

function WelcomeHint({
  icon: Icon,
  children
}: {
  icon: LucideIcon
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-7 place-items-center rounded-full bg-foreground/6">
        <Icon className="size-3.5" aria-hidden="true" />
      </span>
      <span>{children}</span>
    </div>
  )
}

function StepBody({
  eyebrow,
  title,
  description,
  topAligned = false,
  children
}: {
  eyebrow: string
  title: string
  description: string
  topAligned?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex flex-1 flex-col gap-5 text-start',
        topAligned ? 'pt-1' : 'justify-center pb-6'
      )}
    >
      <StepHeading eyebrow={eyebrow} title={title} description={description} />
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  )
}

function StepHeading({
  eyebrow,
  title,
  description
}: {
  eyebrow: string
  title: string
  description: string
}): React.JSX.Element {
  return (
    <header className="flex shrink-0 flex-col gap-1.5 text-start">
      <p className="text-[0.66rem] font-medium text-muted-foreground">{eyebrow}</p>
      <h1 className="text-[1.15rem] font-medium tracking-[-0.035em]">{title}</h1>
      <p className="text-[0.72rem] leading-5 text-muted-foreground">{description}</p>
    </header>
  )
}

function BuildingBlock({
  icon: Icon,
  title,
  description,
  status,
  ready
}: {
  icon: LucideIcon
  title: string
  description: string
  status: string
  ready: boolean
}): React.JSX.Element {
  return (
    <article className="flex min-h-32 flex-col rounded-xl border border-border/60 bg-card/30 p-3 text-start">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-foreground/7 text-muted-foreground">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span
          className={cn('text-[0.58rem]', ready ? 'text-foreground/70' : 'text-muted-foreground')}
        >
          {status}
        </span>
      </div>
      <h2 className="text-xs font-medium">{title}</h2>
      <p className="mt-1 text-[0.64rem] leading-4.5 text-muted-foreground">{description}</p>
    </article>
  )
}

function SpeechModel({
  model,
  active
}: {
  model: AsrModelView
  active: boolean
}): React.JSX.Element {
  const progress =
    model.bytes > 0 ? Math.min(100, Math.round((model.bytesDownloaded / model.bytes) * 100)) : 0
  const installed = model.state === 'installed'
  const downloading = model.state === 'downloading'

  return (
    <article
      className={cn(
        'flex flex-col gap-2.5 rounded-xl border px-3.5 py-3 text-start',
        active && installed ? 'border-foreground/35 bg-foreground/7' : 'border-border/60 bg-card/30'
      )}
    >
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
          <Ear className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate text-sm font-medium">{model.label}</h2>
            {model.isDefault ? (
              <span className="text-[0.58rem] text-muted-foreground">پیشنهاد من</span>
            ) : null}
          </div>
          <p className="text-[0.66rem] text-muted-foreground">
            {model.description} · دانلود {formatBytes(model.bytes)}
          </p>
          <p className="mt-0.5 text-[0.62rem] text-muted-foreground/80">{model.systemHint}</p>
        </div>
        {downloading ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="لغو دانلود"
            onClick={() => void window.api.models.cancel(model.id)}
          >
            <X />
          </Button>
        ) : installed ? (
          active ? (
            <Check className="size-4 text-foreground/70" aria-label="فعال" />
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void window.api.models.setActive(model.id)}
            >
              انتخاب
            </Button>
          )
        ) : (
          <Button size="sm" onClick={() => void window.api.models.download(model.id)}>
            <Download data-icon="inline-start" />
            {model.state === 'error' ? 'تلاش دوباره' : 'دانلود'}
          </Button>
        )}
      </div>
      {downloading ? (
        <div className="flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[0.62rem] tabular-nums text-muted-foreground">{progress}٪</span>
        </div>
      ) : null}
      {model.error ? <p className="text-[0.65rem] text-destructive">{model.error}</p> : null}
    </article>
  )
}

function ReadyStep({
  name,
  assistantShortcut,
  wakeWordShortcut
}: {
  name: string
  assistantShortcut: string
  wakeWordShortcut: string
}): React.JSX.Element {
  const assistantKeys = shortcutDisplayKeys(assistantShortcut, window.api.app.platform)
  const wakeWordKeys = shortcutDisplayKeys(wakeWordShortcut, window.api.app.platform)
  return (
    <div className="flex flex-1 flex-col justify-center gap-6 pb-6 text-start">
      <div className="flex flex-col gap-3">
        <span className="grid size-12 place-items-center rounded-full bg-foreground text-background">
          <Check className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="mb-1 text-[0.66rem] text-muted-foreground">همه‌چی آماده‌ست</p>
          <h1 className="text-[1.35rem] font-medium tracking-[-0.04em]">
            {name.trim() ? `${name.trim()}، من آماده‌م.` : 'من آماده‌م.'}
          </h1>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <ReadyHint icon={Ear} title="با صدا بیدارم کن">
          بگو «هی میکی» یا «میکی». روی گوی هم می‌تونی بزنی.
        </ReadyHint>
        <ReadyHint icon={Keyboard} title="هرجا هستی، با میانبر بازَم کن">
          <span className="flex flex-wrap items-center gap-2">
            این میانبر منو باز می‌کنه
            <KbdGroup dir="ltr">
              {assistantKeys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </KbdGroup>
          </span>
        </ReadyHint>
        <ReadyHint icon={MicOff} title="وقتی نمی‌خوای گوش کنم">
          <span className="flex flex-wrap items-center gap-2">
            شنیدن اسمم رو خاموش یا روشن کن
            <KbdGroup dir="ltr">
              {wakeWordKeys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </KbdGroup>
            میانبرهای دیگه هنوز کار می‌کنن.
          </span>
        </ReadyHint>
        <ReadyHint icon={Volume2} title="بعداً نظرت عوض شد؟">
          تنظیمات همیشه در دسترسه؛ مدل‌ها، صدام و اطلاعاتی که ذخیره کردم همون‌جاست.
        </ReadyHint>
      </div>
    </div>
  )
}

function ReadyHint({
  icon: Icon,
  title,
  children
}: {
  icon: LucideIcon
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex gap-3 rounded-xl border border-border/50 bg-card/25 px-3 py-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="flex flex-col gap-0.5">
        <h2 className="text-xs font-medium">{title}</h2>
        <div className="text-[0.67rem] leading-5 text-muted-foreground">{children}</div>
      </div>
    </div>
  )
}

function Field({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2 text-start">
      <h2 className="text-xs font-medium">{label}</h2>
      {children}
    </div>
  )
}

function TextField({
  value,
  placeholder,
  autoFocus,
  onChange
}: {
  value: string
  placeholder: string
  autoFocus?: boolean
  onChange: (value: string) => void
}): React.JSX.Element {
  return (
    <input
      value={value}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 rounded-lg border border-border/70 bg-background/40 px-3 text-sm outline-none focus-visible:border-ring"
    />
  )
}

function Choice<T extends string>({
  options,
  value,
  horizontal = false,
  onSelect
}: {
  options: Array<{ id: T; label: string }>
  value: T
  horizontal?: boolean
  onSelect: (id: T) => void
}): React.JSX.Element {
  return (
    <div className={cn('grid gap-1.5', horizontal ? 'grid-cols-2' : 'grid-cols-1')}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onSelect(option.id)}
          className={cn(
            'min-h-9 rounded-lg border px-2.5 py-2 text-start text-[0.7rem] transition-colors',
            value === option.id
              ? 'border-foreground/40 bg-foreground/10 text-foreground'
              : 'border-border/60 bg-card/20 text-muted-foreground hover:bg-foreground/5'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function formatBytes(bytes: number): string {
  return `${Math.round(bytes / 1_000_000).toLocaleString('fa-IR')} مگابایت`
}
