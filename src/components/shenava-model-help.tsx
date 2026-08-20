import { Cpu, ExternalLink, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const SHENAVA_COLLECTION_URL =
  'https://huggingface.co/collections/Reza2kn/shenava-10-open-streaming-persian-asr-and-captioning'

export function ShenavaModelHelp({
  className,
  showFolderAction = false
}: {
  className?: string
  showFolderAction?: boolean
}): React.JSX.Element {
  return (
    <aside
      className={cn(
        'flex flex-col gap-2.5 rounded-xl border border-border/50 bg-foreground/4 px-3 py-2.5 text-start',
        className
      )}
    >
      <div className="flex gap-2.5">
        <Cpu className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[0.7rem] font-medium">کدوم مدل رو بردارم؟</h2>
          <p className="text-[0.66rem] leading-5 text-muted-foreground">
            اگه کامپیوترت خیلی قدیمی یا ضعیف نیست، «شنوا کوچیک» هم راحت اجرا می‌شه و دقت بهتری داره.
            «شنوا ریزه» برای سیستم‌های قدیمی‌تر و کم‌قدرت‌تره.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          variant="link"
          size="xs"
          className="px-0"
          onClick={() => void window.api.models.openCard(SHENAVA_COLLECTION_URL)}
        >
          شنوا یه پروژه‌ی متن‌بازه از Reza2kn · دیدن توی Hugging Face
          <ExternalLink data-icon="inline-end" />
        </Button>
        {showFolderAction ? (
          <Button variant="outline" size="xs" onClick={() => void window.api.models.openFolder()}>
            <FolderOpen data-icon="inline-start" />
            پوشه‌ی مدل‌ها
          </Button>
        ) : null}
      </div>
    </aside>
  )
}
