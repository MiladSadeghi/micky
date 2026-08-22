import { memo, useEffect } from 'react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { detectTextDirection } from '@/lib/text-direction'

const MARKDOWN_PLUGINS = [remarkGfm]

const MARKDOWN_COMPONENTS: Components = {
  table({ node, ...props }) {
    void node
    return (
      <div className="flyover-table-scroll" tabIndex={0} role="region" aria-label="جدول پاسخ">
        <table {...props} />
      </div>
    )
  }
}

function FlyoverMarkdownComponent({
  text,
  onRendered
}: {
  text: string
  onRendered: () => void
}): React.JSX.Element {
  useEffect(() => {
    onRendered()
  }, [onRendered, text])

  return (
    <div className="flyover-markdown" dir={detectTextDirection(text)}>
      <Markdown
        remarkPlugins={MARKDOWN_PLUGINS}
        components={MARKDOWN_COMPONENTS}
        skipHtml
        disallowedElements={['img']}
      >
        {text}
      </Markdown>
    </div>
  )
}

export const FlyoverMarkdown = memo(FlyoverMarkdownComponent)
