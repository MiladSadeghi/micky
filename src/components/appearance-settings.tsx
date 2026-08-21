import { Check, Moon, RefreshCw, RotateCcw, Sun } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
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
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { DEFAULT_FONT_FAMILY, type AppTheme, type SettingsSnapshot } from '@/lib/settings'
import { cn } from '@/lib/utils'

const MAX_VISIBLE_FONTS = 120
const FONT_COLLATOR = new Intl.Collator(['fa', 'en'], { numeric: true, sensitivity: 'base' })

type FontLoadState = 'idle' | 'loading' | 'ready' | 'error'

export function AppearanceSettings({
  settings
}: {
  settings: SettingsSnapshot
}): React.JSX.Element {
  const [families, setFamilies] = useState<string[] | null>(null)
  const [fontLoadState, setFontLoadState] = useState<FontLoadState>('idle')
  const [fontLoadError, setFontLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)

  const matchingFamilies = useMemo(() => {
    if (!families) return []
    const query = deferredSearch.trim().toLocaleLowerCase()
    return query
      ? families.filter((family) => family.toLocaleLowerCase().includes(query))
      : families
  }, [deferredSearch, families])
  const visibleFamilies = matchingFamilies.slice(0, MAX_VISIBLE_FONTS)

  const loadSystemFonts = async (): Promise<void> => {
    setFontLoadState('loading')
    setFontLoadError(null)
    try {
      if (!window.queryLocalFonts) throw new Error('unsupported')
      const localFonts = await window.queryLocalFonts()
      const uniqueFamilies = new Set<string>()
      for (const font of localFonts) {
        const family = font.family.trim()
        if (family) uniqueFamilies.add(family)
      }
      setFamilies([...uniqueFamilies].sort(FONT_COLLATOR.compare))
      setFontLoadState('ready')
    } catch (cause) {
      setFontLoadState('error')
      setFontLoadError(fontLoadErrorMessage(cause))
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Card size="sm" className="bg-card/30">
        <CardHeader>
          <CardTitle id="theme-label">حالت نمایش</CardTitle>
          <CardDescription>ظاهر روشن یا تاریک در همه پنجره‌های میکی</CardDescription>
          <CardAction>
            <ToggleGroup
              value={[settings.theme]}
              multiple={false}
              variant="outline"
              spacing={2}
              aria-labelledby="theme-label"
              onValueChange={(value) => {
                const theme = value.at(-1)
                if (isAppTheme(theme) && theme !== settings.theme) {
                  void window.api.settings.setTheme(theme)
                }
              }}
            >
              <ToggleGroupItem value="light" aria-label="حالت روشن">
                <Sun data-icon="inline-start" />
                روشن
              </ToggleGroupItem>
              <ToggleGroupItem value="dark" aria-label="حالت تاریک">
                <Moon data-icon="inline-start" />
                تاریک
              </ToggleGroupItem>
            </ToggleGroup>
          </CardAction>
        </CardHeader>
      </Card>

      <Card size="sm" className="bg-card/30">
        <CardHeader>
          <CardTitle>قلم برنامه</CardTitle>
          <CardDescription>
            قلم پیش‌فرض وزیرمتن، یادگار زنده‌یاد صابر راستی‌کردار است؛ می‌توانی یکی از قلم‌های
            نصب‌شده دستگاه را انتخاب کنی
          </CardDescription>
          {settings.fontFamily !== DEFAULT_FONT_FAMILY ? (
            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void window.api.settings.setFontFamily(DEFAULT_FONT_FAMILY)}
              >
                <RotateCcw data-icon="inline-start" />
                وزیرمتن
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div
            className="rounded-xl border border-border/60 bg-background/45 px-4 py-4 text-start"
            style={{ fontFamily: `"${settings.fontFamily.replaceAll('"', '\\"')}"` }}
          >
            <p className="text-[0.68rem] text-muted-foreground" dir="ltr">
              {settings.fontFamily}
            </p>
            <p className="mt-1 text-base">میکی، همراه کوچیکت برای انجام کارها</p>
          </div>

          {families ? (
            <Field>
              <FieldLabel htmlFor="system-font-search">جستجو میان قلم‌های دستگاه</FieldLabel>
              <Input
                id="system-font-search"
                type="search"
                dir="auto"
                value={search}
                placeholder="نام قلم…"
                onChange={(event) => setSearch(event.target.value)}
              />
              <FieldDescription>
                {matchingFamilies.length.toLocaleString('fa-IR')} قلم پیدا شد
              </FieldDescription>
            </Field>
          ) : (
            <div className="flex flex-col items-start gap-2">
              <Button
                variant="outline"
                disabled={fontLoadState === 'loading'}
                onClick={() => void loadSystemFonts()}
              >
                <RefreshCw data-icon="inline-start" />
                {fontLoadState === 'loading'
                  ? 'دارم قلم‌ها را پیدا می‌کنم…'
                  : 'بارگذاری قلم‌های دستگاه'}
              </Button>
              <p className="text-[0.68rem] leading-5 text-muted-foreground">
                فهرست قلم‌ها فقط با همین دکمه خوانده می‌شود و فایل هیچ قلمی باز یا کپی نمی‌شود
              </p>
            </div>
          )}

          {families ? (
            <ScrollArea className="h-60 rounded-xl border border-border/60 bg-background/25">
              {visibleFamilies.length > 0 ? (
                <div role="listbox" aria-label="قلم‌های دستگاه" className="flex flex-col p-1.5">
                  {visibleFamilies.map((family) => {
                    const selected = family === settings.fontFamily
                    return (
                      <Button
                        key={family}
                        role="option"
                        aria-selected={selected}
                        variant="ghost"
                        className={cn('w-full justify-between', selected && 'bg-muted')}
                        onClick={() => void window.api.settings.setFontFamily(family)}
                      >
                        <span className="truncate" dir="auto">
                          {family}
                        </span>
                        {selected ? <Check aria-hidden="true" /> : null}
                      </Button>
                    )
                  })}
                </div>
              ) : (
                <Empty className="h-full py-10">
                  <EmptyHeader>
                    <EmptyTitle>قلمی پیدا نشد</EmptyTitle>
                    <EmptyDescription>عبارت جستجو را عوض کن</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </ScrollArea>
          ) : null}
        </CardContent>
        {fontLoadError ? (
          <CardFooter className="text-xs text-destructive">{fontLoadError}</CardFooter>
        ) : matchingFamilies.length > MAX_VISIBLE_FONTS ? (
          <CardFooter className="text-xs text-muted-foreground">
            برای سبک ماندن فهرست، {MAX_VISIBLE_FONTS.toLocaleString('fa-IR')} نتیجه اول نمایش داده
            می‌شود؛ برای نتیجه دقیق‌تر جستجو کن
          </CardFooter>
        ) : null}
      </Card>
    </div>
  )
}

function isAppTheme(value: string | undefined): value is AppTheme {
  return value === 'light' || value === 'dark'
}

function fontLoadErrorMessage(cause: unknown): string {
  if (cause instanceof DOMException && cause.name === 'NotAllowedError') {
    return 'اجازه دیدن فهرست قلم‌ها داده نشد؛ دوباره تلاش کن و اجازه را تأیید کن.'
  }
  if (cause instanceof Error && cause.message === 'unsupported') {
    return 'خواندن فهرست قلم‌های دستگاه در این نسخه پشتیبانی نمی‌شود.'
  }
  return 'فهرست قلم‌های دستگاه بارگذاری نشد؛ دوباره تلاش کن.'
}
