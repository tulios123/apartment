import type { ReactElement, ReactNode } from 'react'

// Tiny markdown renderer for our static legal pages: # / ## headings, paragraphs,
// - lists, and **bold** inline. No external dependency (keeps the bundle lean and
// CSP-safe). The source is authored by us, so we don't need to handle arbitrary md.
function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>,
  )
}

export function Markdown({ source }: { source: string }) {
  const blocks: ReactElement[] = []
  let list: string[] = []
  const flush = () => {
    if (!list.length) return
    blocks.push(
      <ul key={blocks.length}>
        {list.map((li, i) => <li key={i}>{renderInline(li)}</li>)}
      </ul>,
    )
    list = []
  }
  for (const raw of source.split('\n')) {
    const line = raw.trim()
    if (!line) { flush(); continue }
    if (line.startsWith('## ')) { flush(); blocks.push(<h2 key={blocks.length}>{renderInline(line.slice(3))}</h2>) }
    else if (line.startsWith('# ')) { flush(); blocks.push(<h1 key={blocks.length}>{renderInline(line.slice(2))}</h1>) }
    else if (line.startsWith('- ')) { list.push(line.slice(2)) }
    else { flush(); blocks.push(<p key={blocks.length}>{renderInline(line)}</p>) }
  }
  flush()
  return <>{blocks}</>
}
