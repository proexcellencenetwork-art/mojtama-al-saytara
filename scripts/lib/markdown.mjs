const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

function hasControlCharacters(value) {
  return [...value].some(character => { const code = character.charCodeAt(0); return code < 32 || code === 127 })
}

function safeHref(value) {
  if (value.startsWith('/') && !value.startsWith('//') && !hasControlCharacters(value)) return value
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch { return null }
}

function inlineHtml(text) {
  const pattern = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*/g
  let offset = 0
  let output = ''
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0
    output += escapeHtml(text.slice(offset, start))
    const href = match[2] ? safeHref(match[2]) : null
    if (match[1] && href) {
      const external = !href.startsWith('/')
      output += `<a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(match[1])}</a>`
    } else if (match[3]) output += `<strong>${escapeHtml(match[3])}</strong>`
    else if (match[4]) output += `<code>${escapeHtml(match[4])}</code>`
    else if (match[5]) output += `<em>${escapeHtml(match[5])}</em>`
    else output += escapeHtml(match[0])
    offset = start + match[0].length
  }
  return output + escapeHtml(text.slice(offset))
}

export function renderMarkdownToHtml(source) {
  const blocks = String(source ?? '').replace(/\r\n?/g, '\n').trim().split(/\n\s*\n/).filter(Boolean)
  return `<div class="formatted-article">${blocks.map(raw => {
    const lines = raw.split('\n').map(line => line.trim()).filter(Boolean)
    const block = lines.join('\n')
    const heading = block.match(/^(#{2,6})\s+(.+)$/)
    if (heading) return `<h${heading[1].length === 2 ? '2' : '3'}>${inlineHtml(heading[2])}</h${heading[1].length === 2 ? '2' : '3'}>`
    if (lines.every(line => /^[-*]\s+/.test(line))) return `<ul>${lines.map(line => `<li>${inlineHtml(line.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`
    if (lines.every(line => /^\d+[.)]\s+/.test(line))) return `<ol>${lines.map(line => `<li>${inlineHtml(line.replace(/^\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`
    if (lines.every(line => /^>\s?/.test(line))) return `<blockquote>${lines.map(line => `<p>${inlineHtml(line.replace(/^>\s?/, ''))}</p>`).join('')}</blockquote>`
    return `<p>${lines.map(inlineHtml).join('<br>')}</p>`
  }).join('')}</div>`
}
