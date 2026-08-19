import { Mic, MicOff, RotateCcw } from 'lucide-react'
import { ThinkingOrb, type OrbState } from 'thinking-orbs'
import { Button } from '@/components/ui/button'
import { useWakeWord } from '@/hooks/use-wake-word'

const PHASE_CONTENT = {
  disabled: {
    eyebrow: 'میکروفن خاموش است',
    title: 'هر وقت خواستی، شروع کنیم',
    hint: 'برای فعال‌کردن شنیدن روی گوی بزن.'
  },
  loading: {
    eyebrow: 'در حال آماده‌شدن',
    title: 'یک لحظه…',
    hint: 'مدل بیدارباش روی دستگاهت بارگذاری می‌شود.'
  },
  listening: {
    eyebrow: 'میکی گوش‌به‌زنگ است',
    title: 'بگو «هی نیمروز»',
    hint: 'یا برای شروع مستقیم روی گوی بزن.'
  },
  activated: {
    eyebrow: 'صدات رو شنیدم',
    title: 'گوش می‌دم…',
    hint: 'حالا بگو چه کاری برات انجام بدم.'
  },
  error: {
    eyebrow: 'میکروفن آماده نیست',
    title: 'نتونستم گوش بدم',
    hint: 'دسترسی میکروفن را بررسی کن و دوباره تلاش کن.'
  }
} as const

const ORB_STATE: Record<keyof typeof PHASE_CONTENT, OrbState> = {
  disabled: 'breathing',
  loading: 'connecting',
  listening: 'breathing',
  activated: 'listening',
  error: 'shaping'
}

function App(): React.JSX.Element {
  const status = useWakeWord()
  const phase = status?.phase ?? 'loading'
  const content = PHASE_CONTENT[phase]
  const enabled = status?.enabled ?? true
  const isActivated = phase === 'activated'
  const isLoading = phase === 'loading'

  const handleOrbClick = (): void => {
    if (isLoading) return
    if (phase === 'error') {
      void window.api.wakeWord.retry()
      return
    }
    void window.api.wakeWord.activateManually()
  }

  return (
    <main className="voice-shell flex min-h-full flex-col overflow-hidden text-center">
      <header className="app-titlebar" aria-hidden="true" />

      <section className="flex flex-1 flex-col items-center justify-center px-6 pb-8">
        <button
          type="button"
          className="orb-trigger"
          data-phase={phase}
          onClick={handleOrbClick}
          disabled={isLoading}
          aria-label={isActivated ? 'پایان شنیدن و بازگشت به حالت آماده' : 'شروع شنیدن'}
          aria-pressed={isActivated}
        >
          <span className="orb-aura" aria-hidden="true" />
          <span className="orb-core">
            <ThinkingOrb
              state={ORB_STATE[phase]}
              size={64}
              theme="dark"
              speed={isActivated ? 1.25 : 0.82}
              paused={phase === 'disabled' || phase === 'error'}
              aria-label={isActivated ? 'میکی در حال گوش‌دادن است' : 'میکی آماده شنیدن است'}
            />
          </span>
        </button>

        <div
          className="mt-11 flex min-h-28 max-w-xs flex-col items-center gap-2"
          aria-live="polite"
        >
          <p className="text-xs font-medium text-muted-foreground">{content.eyebrow}</p>
          <h2 className="text-[1.7rem] font-semibold tracking-[-0.045em]">{content.title}</h2>
          <p className="max-w-64 text-xs leading-6 text-muted-foreground">
            {status?.error ?? content.hint}
          </p>
        </div>
      </section>

      <footer className="flex flex-col items-center gap-3 px-6 pb-5">
        {phase === 'error' ? (
          <Button variant="outline" size="sm" onClick={() => void window.api.wakeWord.retry()}>
            <RotateCcw data-icon="inline-start" />
            تلاش دوباره
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void window.api.wakeWord.setEnabled(!enabled)}
          >
            {enabled ? <Mic data-icon="inline-start" /> : <MicOff data-icon="inline-start" />}
            {enabled ? 'شنیدن عبارت بیدارباش روشن است' : 'شنیدن خاموش است'}
          </Button>
        )}
        <p className="text-[0.62rem] leading-5 text-muted-foreground/70">
          پردازش صدا روی همین دستگاه انجام می‌شود
        </p>
      </footer>
    </main>
  )
}

export default App
