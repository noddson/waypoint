import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { JournalMarkdown } from './JournalMarkdown'

describe('journal Markdown rendering',()=>{
  it('renders CommonMark and GitHub-flavoured formatting',()=>{
    const markdown=`## A memorable day

We saw **puffins**, ate *scones*, and saved [the map](https://example.com/map).

- First stop
- Second stop

- [x] Packed
- [ ] Posted

Use \`layers\` and remember ~~the rain~~ the sunshine.

| Time | Place |
| --- | --- |
| 09:00 | Harbour |

\`\`\`text
packed and ready
\`\`\``
    const html=renderToStaticMarkup(<JournalMarkdown>{markdown}</JournalMarkdown>)

    expect(html).toContain('<div class="journal-heading journal-heading-2" role="heading" aria-level="6">A memorable day</div>')
    expect(html).toContain('<strong>puffins</strong>')
    expect(html).toContain('<em>scones</em>')
    expect(html).toContain('<ul class="contains-task-list">')
    expect(html).toContain('<code>layers</code>')
    expect(html).toContain('<del>the rain</del>')
    expect(html).toContain('class="task-list-item"')
    expect(html).toContain('<pre tabindex="0"><code class="language-text">packed and ready')
    expect(html).toContain('<table tabindex="0">')
    expect(html).toContain('href="https://example.com/map"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noreferrer"')
  })

  it('drops raw HTML and unsafe or non-HTTPS URLs',()=>{
    const markdown='<script>alert("bad")</script>\n\n[unsafe](javascript:alert("bad")) [plain](http://example.com) ![pixel](https://example.com/tracker.png)'
    const html=renderToStaticMarkup(<JournalMarkdown>{markdown}</JournalMarkdown>)

    expect(html).not.toContain('<script')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('http://example.com')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('tracker.png')
    expect(html).toContain('[Image: pixel]')
  })
})
