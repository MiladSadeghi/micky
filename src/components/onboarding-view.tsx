import { useState } from 'react'
import {
  EMPTY_USER_PROFILE,
  type AddressForm,
  type LanguageMix,
  type ReplyLength,
  type UserProfileDraft
} from '@/lib/soul'
import { Button } from '@/components/ui/button'
import { LlmSettings } from '@/components/llm-settings'
import { useLlm } from '@/hooks/use-llm'
import { cn } from '@/lib/utils'

type Step = 0 | 1 | 2 | 3 | 4 | 5

const FORM_STEPS = 5

export function OnboardingView(): React.JSX.Element {
  const llm = useLlm()
  const [step, setStep] = useState<Step>(0)
  const [draft, setDraft] = useState<UserProfileDraft>(EMPTY_USER_PROFILE)
  const [busy, setBusy] = useState(false)

  const patch = (update: Partial<UserProfileDraft>): void => {
    setDraft((current) => ({ ...current, ...update }))
  }

  const finish = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.api.soul.completeOnboarding(draft)
    } finally {
      setBusy(false)
    }
  }

  const skip = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.api.soul.completeOnboarding(EMPTY_USER_PROFILE)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="voice-shell flex h-full min-h-0 flex-col overflow-hidden">
      <header className="app-titlebar shrink-0" aria-hidden="true" />

      {step > 0 ? (
        <div className="flex shrink-0 items-center gap-1.5 px-5 pb-3">
          {Array.from({ length: FORM_STEPS }, (_, index) => (
            <span
              key={index}
              className={cn(
                'h-1 flex-1 rounded-full',
                index < step ? 'bg-foreground/80' : 'bg-foreground/15'
              )}
            />
          ))}
        </div>
      ) : (
        <div className="h-3 shrink-0" />
      )}

      <section className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-3">
        {step === 0 ? (
          <div className="flex flex-1 flex-col justify-center gap-5 text-start">
            <div className="flex flex-col gap-3">
              <p className="text-[0.75rem] text-muted-foreground">میکی</p>
              <h1 className="text-[1.45rem] leading-8 font-medium tracking-[-0.04em]">
                سلام. من میکی‌ام.
              </h1>
              <p className="max-w-[18rem] text-[0.92rem] leading-7 text-muted-foreground">
                دستیار صوتی‌ات می‌شم. قرار نیست هر دفعه از صفر شروع کنیم. کم‌کم باهات بزرگ می‌شم.
              </p>
              <p className="max-w-[18rem] text-[0.92rem] leading-7 text-muted-foreground">
                اول چند تا چیز کوتاه می‌پرسم. اسمت، اینکه چطور صدات کنم، یک مدل برای حرف زدن.
              </p>
            </div>
            <Button className="self-start" onClick={() => setStep(1)}>
              بریم چند تا چیز رو رد کنیم
            </Button>
          </div>
        ) : null}

        {step === 1 ? (
          <FormBody>
            <Field label="اسمت چیه؟">
              <TextField
                value={draft.name}
                placeholder="مانی"
                onChange={(name) => patch({ name })}
                onSubmit={() => setStep(2)}
              />
            </Field>
            <Field label="چطور صدات کنم؟">
              <Choice
                options={[
                  { id: 'to', label: 'تو' },
                  { id: 'shoma', label: 'شما' }
                ]}
                value={draft.addressForm}
                onSelect={(addressForm: AddressForm) => patch({ addressForm })}
              />
            </Field>
          </FormBody>
        ) : null}

        {step === 2 ? (
          <FormBody>
            <Field label="چطور حرف بزنم؟">
              <Choice
                options={[
                  { id: 'mixed', label: 'فارسی، انگلیسی اگر لازم شد' },
                  { id: 'persian', label: 'فقط فارسی' }
                ]}
                value={draft.languageMix}
                onSelect={(languageMix: LanguageMix) => patch({ languageMix })}
              />
            </Field>
          </FormBody>
        ) : null}

        {step === 3 ? (
          <FormBody>
            <Field label="کجایی؟">
              <TextField
                value={draft.city}
                placeholder="تهران"
                onChange={(city) => patch({ city })}
              />
            </Field>
            <Field label="چیکار می‌کنی؟">
              <TextField
                value={draft.work}
                placeholder="برنامه‌نویس، دانشجو، …"
                onChange={(work) => patch({ work })}
                onSubmit={() => setStep(4)}
              />
            </Field>
          </FormBody>
        ) : null}

        {step === 4 ? (
          <FormBody>
            <Field label="بیشتر کمک چی می‌خوای؟">
              <TextField
                value={draft.focus}
                placeholder="سؤال، یادداشت، برنامه‌ریزی"
                onChange={(focus) => patch({ focus })}
              />
            </Field>
            <Field label="جواب‌ها؟">
              <Choice
                options={[
                  { id: 'short', label: 'کوتاه' },
                  { id: 'medium', label: 'یک کم بیشتر' }
                ]}
                value={draft.replyLength}
                onSelect={(replyLength: ReplyLength) => patch({ replyLength })}
              />
            </Field>
          </FormBody>
        ) : null}

        {step === 5 ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2.5 text-start">
            <h1 className="shrink-0 text-[1.05rem] font-medium tracking-[-0.03em]">مدل و کلید</h1>
            <p className="shrink-0 text-[0.75rem] leading-5 text-muted-foreground">
              کلید OpenRouter را بگذار، یک مدل انتخاب کن. بعدا از تنظیمات عوض می‌شود.
            </p>
            <div className="flex min-h-0 flex-1 flex-col">
              <LlmSettings snapshot={llm} compact />
            </div>
          </div>
        ) : null}
      </section>

      {step === 0 ? (
        <footer className="flex shrink-0 justify-start px-5 pb-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={busy}
            onClick={() => void skip()}
          >
            بعدا
          </Button>
        </footer>
      ) : (
        <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-border/40 px-5 pt-3 pb-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={busy}
            onClick={() => void skip()}
          >
            بعدا
          </Button>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => setStep((step - 1) as Step)}>
              برگشت
            </Button>
            {step < 5 ? (
              <Button size="sm" onClick={() => setStep((step + 1) as Step)}>
                ادامه
              </Button>
            ) : (
              <Button size="sm" disabled={busy} onClick={() => void finish()}>
                بزن بریم
              </Button>
            )}
          </div>
        </footer>
      )}
    </main>
  )
}

function FormBody({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col justify-center pb-10 text-start">
      <div className="flex flex-col gap-5">{children}</div>
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
    <div className="flex flex-col gap-2.5 text-start">
      <h1 className="text-[1.05rem] font-medium tracking-[-0.03em]">{label}</h1>
      {children}
    </div>
  )
}

function TextField({
  value,
  placeholder,
  onChange,
  onSubmit
}: {
  value: string
  placeholder: string
  onChange: (value: string) => void
  onSubmit?: () => void
}): React.JSX.Element {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && onSubmit) onSubmit()
      }}
      className="h-9 rounded-lg border border-border/70 bg-background/40 px-3 text-sm outline-none focus-visible:border-ring"
    />
  )
}

function Choice<T extends string>({
  options,
  value,
  onSelect
}: {
  options: Array<{ id: T; label: string }>
  value: T
  onSelect: (id: T) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onSelect(option.id)}
          className={cn(
            'rounded-lg border px-3 py-2 text-start text-sm transition-colors',
            value === option.id
              ? 'border-foreground/40 bg-foreground/10'
              : 'border-border/60 bg-card/20 text-muted-foreground hover:bg-foreground/5'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
