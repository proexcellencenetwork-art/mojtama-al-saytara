import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

function hasControlCharacters(value: string): boolean {
  return [...value].some(character => { const code = character.charCodeAt(0); return code < 32 || code === 127 })
}

function safeHref(value: string): string | null {
  if (value.startsWith('/') && !value.startsWith('//') && !hasControlCharacters(value)) return value
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

function inlineNodes(text: string): ReactNode[] {
  const output: ReactNode[] = []
  const pattern = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*/g
  let offset = 0
  let index = 0
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0
    if (start > offset) output.push(text.slice(offset, start))
    const label = match[1]
    const href = match[2] ? safeHref(match[2]) : null
    if (label && href) {
      output.push(href.startsWith('/')
        ? <Link key={`m-${index++}`} to={href}>{label}</Link>
        : <a key={`m-${index++}`} href={href} target="_blank" rel="noopener noreferrer">{label}</a>)
    } else if (match[3]) output.push(<strong key={`m-${index++}`}>{match[3]}</strong>)
    else if (match[4]) output.push(<code key={`m-${index++}`}>{match[4]}</code>)
    else if (match[5]) output.push(<em key={`m-${index++}`}>{match[5]}</em>)
    else output.push(match[0])
    offset = start + match[0].length
  }
  if (offset < text.length) output.push(text.slice(offset))
  return output
}

export function MarkdownBody({ source }: { source: string }) {
  const blocks = source.replace(/\r\n?/g, '\n').trim().split(/\n\s*\n/).filter(Boolean)
  return <div className="formatted-article">{blocks.map((raw, index) => {
    const lines = raw.split('\n').map(line => line.trim()).filter(Boolean)
    const block = lines.join('\n')
    const heading = block.match(/^(#{2,6})\s+(.+)$/)
    if (heading) {
      const text = inlineNodes(heading[2])
      return heading[1].length === 2
        ? <h2 key={index}>{text}</h2>
        : <h3 key={index}>{text}</h3>
    }
    if (lines.every(line => /^[-*]\s+/.test(line))) {
      return <ul key={index}>{lines.map((line, item) => <li key={item}>{inlineNodes(line.replace(/^[-*]\s+/, ''))}</li>)}</ul>
    }
    if (lines.every(line => /^\d+[.)]\s+/.test(line))) {
      return <ol key={index}>{lines.map((line, item) => <li key={item}>{inlineNodes(line.replace(/^\d+[.)]\s+/, ''))}</li>)}</ol>
    }
    if (lines.every(line => /^>\s?/.test(line))) {
      return <blockquote key={index}>{lines.map((line, item) => <p key={item}>{inlineNodes(line.replace(/^>\s?/, ''))}</p>)}</blockquote>
    }
    return <p key={index}>{lines.map((line, item) => <span key={item}>{item > 0 && <br/>}{inlineNodes(line)}</span>)}</p>
  })}</div>
}
