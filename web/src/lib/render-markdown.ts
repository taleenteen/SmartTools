function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inlineFormat(src: string): string {
  return escapeHtml(src)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
}

export function renderMarkdown(source: string): string {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i] ?? ''
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      const marks = heading[1] ?? '#'
      const level = marks.length
      out.push(`<h${level}>${inlineFormat(heading[2] ?? '')}</h${level}>`)
      i++
      continue
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      out.push('<ul>')
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i] ?? '')) {
        out.push(`<li>${inlineFormat((lines[i] ?? '').replace(/^\s*[-*+]\s+/, ''))}</li>`)
        i++
      }
      out.push('</ul>')
      continue
    }
    if (/^\s*>\s?/.test(line)) {
      const quote: string[] = []
      while (i < lines.length && /^\s*>\s?/.test(lines[i] ?? '')) {
        quote.push(inlineFormat((lines[i] ?? '').replace(/^\s*>\s?/, '')))
        i++
      }
      out.push(`<blockquote>${quote.join('<br>')}</blockquote>`)
      continue
    }
    if (line.trim() === '') {
      i++
      continue
    }
    const para: string[] = []
    while (i < lines.length && (lines[i] ?? '').trim() !== '') {
      para.push(inlineFormat(lines[i] ?? ''))
      i++
    }
    out.push(`<p>${para.join('<br>')}</p>`)
  }
  return out.join('')
}
