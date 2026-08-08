import ReactMarkdown, { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { safeHttpsLink } from './tripImport'

const journalMarkdownComponents:Components = {
  a:({node:_,...props})=><a {...props} target="_blank" rel="noreferrer" onClick={event=>event.stopPropagation()}/>,
  h1:({children})=><div className="journal-heading journal-heading-1" role="heading" aria-level={5}>{children}</div>,
  h2:({children})=><div className="journal-heading journal-heading-2" role="heading" aria-level={6}>{children}</div>,
  h3:({children})=><div className="journal-heading journal-heading-3" role="heading" aria-level={7}>{children}</div>,
  h4:({children})=><div className="journal-heading journal-heading-4" role="heading" aria-level={8}>{children}</div>,
  h5:({children})=><div className="journal-heading journal-heading-5" role="heading" aria-level={9}>{children}</div>,
  h6:({children})=><div className="journal-heading journal-heading-6" role="heading" aria-level={10}>{children}</div>,
  img:({alt})=><span className="journal-image-alt">{alt?`[Image: ${alt}]`:'[Image]'}</span>,
  pre:({node:_,...props})=><pre {...props} tabIndex={0}/>,
  table:({node:_,...props})=><table {...props} tabIndex={0}/>,
}

export function JournalMarkdown({children}:{children:string}) {
  return <div className="journal-text"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={url=>safeHttpsLink(url)} components={journalMarkdownComponents}>{children}</ReactMarkdown></div>
}
