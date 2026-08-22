import { Check, Download, ExternalLink, RefreshCw } from 'lucide-react'
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
import type { AppUpdateSnapshot } from '@/lib/app-update'

export function AppVersionSettings({
  snapshot
}: {
  snapshot: AppUpdateSnapshot | null
}): React.JSX.Element {
  const checking = snapshot?.phase === 'checking'
  const updateAvailable = snapshot?.updateAvailable === true
  const notesVersion = updateAvailable ? snapshot.latestVersion : snapshot?.currentVersion
  const notes = updateAvailable ? snapshot.releaseNotes : snapshot?.currentReleaseNotes
  const noteSections = parseReleaseNotes(notes ?? '')

  return (
    <div className="flex flex-col gap-3">
      <Card size="sm" className="bg-card/30">
        <CardHeader>
          <CardTitle>نسخه میکی</CardTitle>
          <CardDescription>
            {updateAvailable && snapshot?.latestVersion
              ? `نسخه ${snapshot.latestVersion} برای دانلود آماده است`
              : snapshot?.phase === 'error'
                ? 'بررسی نسخه تازه ممکن نشد؛ اتصال اینترنت را بررسی کن'
                : checking
                  ? 'در حال بررسی آخرین انتشار…'
                  : 'میکی به‌روز است'}
          </CardDescription>
          <CardAction>
            {updateAvailable ? (
              <Button size="sm" onClick={() => void window.api.updates.openDownload()}>
                <Download data-icon="inline-start" />
                دانلود {snapshot.latestVersion}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={checking}
                onClick={() => void window.api.updates.check()}
              >
                {snapshot?.phase === 'ready' ? (
                  <Check data-icon="inline-start" />
                ) : (
                  <RefreshCw data-icon="inline-start" className={checking ? 'animate-spin' : ''} />
                )}
                {checking ? 'در حال بررسی' : 'بررسی دوباره'}
              </Button>
            )}
          </CardAction>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <Badge variant="secondary" dir="ltr">
            v{snapshot?.currentVersion ?? '…'}
          </Badge>
          <span className="text-[0.68rem] text-muted-foreground">نسخه نصب‌شده</span>
          {updateAvailable && snapshot?.latestVersion ? (
            <>
              <span className="text-muted-foreground" aria-hidden="true">
                ←
              </span>
              <Badge dir="ltr">v{snapshot.latestVersion}</Badge>
            </>
          ) : null}
        </CardContent>
        {snapshot?.checkedAt ? (
          <CardFooter className="text-[0.65rem] text-muted-foreground">
            آخرین بررسی: {formatCheckedAt(snapshot.checkedAt)}
          </CardFooter>
        ) : null}
      </Card>

      <Card size="sm" className="bg-card/30">
        <CardHeader>
          <CardTitle>تغییرات نسخه {notesVersion ?? ''}</CardTitle>
          <CardDescription>
            {updateAvailable ? 'چیزهایی که با نسخه تازه می‌رسند' : 'تازه‌ترین تغییرات این نسخه'}
          </CardDescription>
          <CardAction>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void window.api.updates.openReleases()}
            >
              <ExternalLink data-icon="inline-start" />
              همه نسخه‌ها
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {noteSections.length > 0 ? (
            <div className="flex flex-col gap-4 text-start">
              {noteSections.map((section) => (
                <section
                  key={`${section.title}-${section.items[0] ?? ''}`}
                  className="flex flex-col gap-2"
                >
                  {section.title ? <h3 className="text-xs font-medium">{section.title}</h3> : null}
                  <ul className="flex list-disc flex-col gap-1.5 pe-4 text-[0.7rem] leading-5 text-muted-foreground marker:text-muted-foreground/60">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <p className="text-[0.7rem] leading-5 text-muted-foreground">
              جزئیات این نسخه در صفحه انتشار GitHub در دسترس است.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

type NoteSection = { title: string; items: string[] }

function parseReleaseNotes(markdown: string): NoteSection[] {
  const sections: NoteSection[] = []
  let current: NoteSection = { title: '', items: [] }

  for (const sourceLine of markdown.split('\n')) {
    const line = sourceLine.trim()
    if (!line || /full changelog/i.test(line)) continue
    if (line.startsWith('#')) {
      if (current.items.length > 0) sections.push(current)
      current = { title: translateHeading(cleanMarkdown(line.replace(/^#+\s*/, ''))), items: [] }
      continue
    }
    const item = cleanMarkdown(line.replace(/^[-*]\s+/, ''))
    if (item) current.items.push(item)
  }
  if (current.items.length > 0) sections.push(current)
  return sections
}

function cleanMarkdown(value: string): string {
  return value
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[*_`]/g, '')
    .trim()
}

function translateHeading(value: string): string {
  const headings: Record<string, string> = {
    Added: 'تازه‌ها',
    Changed: 'بهبودها',
    Fixed: 'رفع‌شده‌ها',
    Removed: 'حذف‌شده‌ها',
    Security: 'امنیت'
  }
  return headings[value] ?? value
}

function formatCheckedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date)
}
