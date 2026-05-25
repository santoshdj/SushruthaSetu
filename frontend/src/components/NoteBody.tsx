/**
 * Renders clinical note text with structured formatting:
 *  - Lines starting with # / ## / ###  → markdown-style bold section heading
 *  - Lines ending in ':'               → bold inline section label
 *  - Lines starting with - • *         → bullet list
 *  - Everything else                   → regular paragraph
 */
export function NoteBody({ text }: { text: string }) {
  const elements: React.ReactNode[] = []
  const bulletBuffer: string[] = []
  let key = 0

  const flushBullets = () => {
    if (!bulletBuffer.length) return
    elements.push(
      <ul key={key++} className="list-disc list-inside space-y-0.5 pl-1 my-1">
        {bulletBuffer.map((b, i) => (
          <li key={i} className="text-sm text-gray-700 leading-relaxed">
            {b}
          </li>
        ))}
      </ul>
    )
    bulletBuffer.length = 0
  }

  for (const raw of text.split('\n')) {
    const line = raw.trim()

    if (!line) {
      flushBullets()
      continue
    }

    if (/^[-•*]\s+/.test(line)) {
      bulletBuffer.push(line.replace(/^[-•*]\s+/, ''))
      continue
    }

    flushBullets()

    // Markdown headings: #, ##, ###
    const mdMatch = line.match(/^(#{1,3})\s+(.+)/)
    if (mdMatch) {
      const level = mdMatch[1].length
      const headingText = mdMatch[2]
      const cls =
        level === 1
          ? 'text-base font-bold text-gray-900 mt-4 first:mt-0'
          : level === 2
          ? 'text-sm font-bold text-gray-800 mt-3 first:mt-0'
          : 'text-sm font-semibold text-gray-700 mt-2 first:mt-0'
      elements.push(
        <p key={key++} className={cls}>
          {headingText}
        </p>
      )
      continue
    }

    // Colon-terminated inline labels
    const isLabel = line.endsWith(':') && line.length < 80 && !line.includes('.')
    elements.push(
      isLabel ? (
        <p key={key++} className="text-sm font-semibold text-gray-800 mt-3 first:mt-0">
          {line}
        </p>
      ) : (
        <p key={key++} className="text-sm text-gray-700 leading-relaxed">
          {line}
        </p>
      )
    )
  }

  flushBullets()

  return <div className="space-y-0.5">{elements}</div>
}
