import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { FlyoverMarkdown } from '@/components/flyover-markdown'

test('renders flyover emphasis and GFM tables as semantic markup', () => {
  const html = renderToStaticMarkup(
    createElement(FlyoverMarkdown, {
      text: '**نتیجه**\n\n| نام | مقدار |\n| --- | --- |\n| سرعت | خوب |',
      onRendered() {}
    })
  )

  assert.match(html, /<strong>نتیجه<\/strong>/)
  assert.match(html, /class="flyover-table-scroll"/)
  assert.match(html, /<table>/)
})

test('does not render raw HTML or Markdown images in the flyover', () => {
  const html = renderToStaticMarkup(
    createElement(FlyoverMarkdown, {
      text: '<script>alert(1)</script>\n\n![remote](https://example.com/image.png)',
      onRendered() {}
    })
  )

  assert.doesNotMatch(html, /<script|<img/i)
})
