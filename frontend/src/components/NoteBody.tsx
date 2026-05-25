/**
 * Renders clinical note text with structured formatting:
 *  - Lines ending in ':'  → bold section header
 *  - Lines starting with - • *  → bullet list
 *  - Everything else  → regular paragraph
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

    const isHeader =
      line.endsWith(':') && line.length < 80 && !line.includes('.')

    elements.push(
      isHeader ? (
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
