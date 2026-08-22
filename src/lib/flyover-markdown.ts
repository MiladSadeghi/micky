const BLOCK_MARKDOWN =
  /(?:^|\n)\s{0,3}(?:#{1,6}\s|>\s|[-+*]\s|\d+[.)]\s|```|~~~|(?:-{3,}|\*{3,}|_{3,})\s*$)/m
const INLINE_MARKDOWN =
  /(?:\*\*[^\n*]+\*\*|__[^\n_]+__|~~[^\n~]+~~|`[^\n`]+`|\[[^\]\n]+\]\([^)\n]+\))/
const EMPHASIS_MARKDOWN = /(?:^|[\s([{])(?:\*[^*\n]+\*|_[^_\n]+_)(?=$|[\s)\]},.!?؛،:])/m
const TABLE_MARKDOWN = /(?:^|\n)\s*\|?.+\|.+\n\s*\|?\s*:?-{3,}/m
const AUTOLINK_MARKDOWN = /https?:\/\/\S+/

export function hasFlyoverMarkdown(text: string): boolean {
  return (
    BLOCK_MARKDOWN.test(text) ||
    INLINE_MARKDOWN.test(text) ||
    EMPHASIS_MARKDOWN.test(text) ||
    TABLE_MARKDOWN.test(text) ||
    AUTOLINK_MARKDOWN.test(text)
  )
}
