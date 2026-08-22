import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { AppUpdateSnapshot } from '@/lib/app-update'

export function AppUpdateNotice({
  snapshot
}: {
  snapshot: AppUpdateSnapshot | null
}): React.JSX.Element | null {
  if (!snapshot?.updateAvailable || !snapshot.latestVersion) return null

  return (
    <Card size="sm" className="mx-4 mt-2 shrink-0 bg-card/60 text-start" aria-live="polite">
      <CardHeader className="pe-2">
        <CardTitle>نسخه {snapshot.latestVersion} آماده‌ست</CardTitle>
        <CardDescription className="text-[0.65rem]">
          نسخه فعلی تو {snapshot.currentVersion} است
        </CardDescription>
        <CardAction>
          <Button size="sm" onClick={() => void window.api.updates.openDownload()}>
            <Download data-icon="inline-start" />
            دانلود
          </Button>
        </CardAction>
      </CardHeader>
    </Card>
  )
}
