import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ChatDetail } from '@/lib/chats'

export function ConversationPreview({
  chat,
  onOpen
}: {
  chat: ChatDetail
  onOpen: () => void
}): React.JSX.Element {
  const recent = chat.messages.slice(-2)
  if (recent.length === 0) return <></>

  return (
    <Button
      variant="ghost"
      className="conversation-preview h-auto w-full max-w-80 items-stretch justify-start px-3 py-2.5 text-start whitespace-normal"
      onClick={onOpen}
      aria-label={`بازکردن گفتگوی ${chat.title}`}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        {recent.map((message) => (
          <span key={message.id} className="flex min-w-0 items-baseline gap-2">
            <span className="w-7 shrink-0 text-[0.62rem] text-muted-foreground">
              {message.role === 'user' ? 'تو' : 'میکی'}
            </span>
            <span className="line-clamp-2 text-xs leading-5 text-foreground/80">
              {message.content}
            </span>
          </span>
        ))}
      </span>
      <ChevronLeft aria-hidden="true" />
    </Button>
  )
}
