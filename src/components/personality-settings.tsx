import { Brain, FileText, Sparkles, UserRound } from 'lucide-react'
import type { SoulSnapshot } from '@/lib/soul'
import { parseMarkdownDocument, parseUserFacts } from '@/lib/soul'

export function PersonalitySettings({
  snapshot
}: {
  snapshot: SoulSnapshot | null
}): React.JSX.Element {
  const personality = parseMarkdownDocument(snapshot?.files.soul ?? '', 'میکی')
  const userFacts = parseUserFacts(snapshot?.files.user ?? '')
  const memory = parseMarkdownDocument(snapshot?.files.memory ?? '', 'حافظه')
  const memories = memory.statements.filter(
    (statement) => !statement.startsWith('حقایقی که میکی در طول گفتگو یاد گرفته')
  )

  return (
    <div className="flex flex-col gap-5">
      <SettingsGroup
        icon={Sparkles}
        title="شخصیت میکی"
        description={`${personality.statements.length.toLocaleString('fa-IR')} اصل رفتاری از ${personality.title}`}
      >
        {personality.statements.length > 0 ? (
          <div className="flex flex-col">
            {personality.statements.map((statement, index) => (
              <div
                key={`${statement}-${index}`}
                className="flex items-start gap-3 border-b border-border/40 px-3.5 py-3 last:border-b-0"
              >
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-foreground/55" />
                <p className="text-xs leading-6 text-foreground/90" dir="auto">
                  {statement}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyCopy>هنوز برای شخصیت میکی چیزی نوشته نشده.</EmptyCopy>
        )}
      </SettingsGroup>

      <SettingsGroup
        icon={UserRound}
        title="دربارهٔ تو"
        description="چیزهایی که میکی برای بهتر حرف‌زدن با تو می‌داند"
      >
        {userFacts.length > 0 ? (
          <dl className="grid grid-cols-2 gap-px bg-border/40">
            {userFacts.map((fact) => (
              <div key={fact.label} className="min-w-0 bg-card/70 px-3.5 py-3 text-start">
                <dt className="text-[0.65rem] text-muted-foreground">{fact.label}</dt>
                <dd className="mt-1 truncate text-xs font-medium" title={fact.value} dir="auto">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <EmptyCopy>هنوز چیزی از تو ثبت نشده.</EmptyCopy>
        )}
      </SettingsGroup>

      <SettingsGroup
        icon={Brain}
        title="حافظه"
        description={`${memories.length.toLocaleString('fa-IR')} نکتهٔ ماندگار از گفتگوها`}
      >
        {memories.length > 0 ? (
          <div className="flex flex-col">
            {memories.map((memoryItem, index) => (
              <p
                key={`${memoryItem}-${index}`}
                className="border-b border-border/40 px-3.5 py-3 text-xs leading-6 last:border-b-0"
                dir="auto"
              >
                {memoryItem}
              </p>
            ))}
          </div>
        ) : (
          <EmptyCopy>میکی هنوز چیزی را برای بعد به خاطر نسپرده.</EmptyCopy>
        )}
      </SettingsGroup>

      <div className="flex items-start gap-2.5 px-1 text-start text-[0.68rem] leading-5 text-muted-foreground">
        <FileText className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <p>
          این صفحه مستقیما از فایل‌های شخصیت، کاربر و حافظه خوانده می‌شود و با یادگیری میکی به‌روز
          می‌ماند.
        </p>
      </div>
    </div>
  )
}

function SettingsGroup({
  icon: Icon,
  title,
  description,
  children
}: {
  icon: typeof Sparkles
  title: string
  description: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="flex flex-col gap-2 text-start">
      <header className="flex items-start gap-2.5 px-0.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-foreground/8 text-foreground/80">
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-medium">{title}</h2>
          <p className="mt-0.5 text-[0.68rem] leading-5 text-muted-foreground">{description}</p>
        </div>
      </header>
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card/35">
        {children}
      </div>
    </section>
  )
}

function EmptyCopy({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className="px-3.5 py-4 text-xs text-muted-foreground">{children}</p>
}
