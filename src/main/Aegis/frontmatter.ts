// Front matter = a block at the very top of a note between two `---` lines
const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

/** Split a note into its front matter (without the --- lines) and the rest */
export function splitFrontMatter(text: string): { front: string; body: string } {
  const m = text.match(FRONT_MATTER)
  if (!m) return { front: '', body: text }
  return { front: m[1], body: text.slice(m[0].length) }
}

/** "Work", "#work", " work " → "work"; "To Do" → "to-do" */
export function normalizeTags(raw: string[]): string[] {
  const seen = new Set<string>()
  for (const r of raw) {
    const tag = r
      .trim()
      .replace(/^["']|["']$/g, '') // strip quotes
      .replace(/^#/, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
    if (tag) seen.add(tag)
  }
  return [...seen]
}

/**
 * Reads `tags:` from front matter. Supports:
 *   tags: [work, bug]
 *   tags: work, bug
 *   tags:
 *     - work
 *     - bug
 */
export function parseTags(front: string): string[] {
  if (!front) return []
  const lines = front.split(/\r?\n/)
  const i = lines.findIndex((l) => /^tags\s*:/i.test(l))
  if (i === -1) return []

  const rest = lines[i].replace(/^tags\s*:/i, '').trim()
  let raw: string[] = []

  if (rest.startsWith('[')) {
    raw = rest.replace(/^\[|\]$/g, '').split(',')
  } else if (rest) {
    raw = rest.split(',')
  } else {
    for (let j = i + 1; j < lines.length; j++) {
      const item = lines[j].match(/^\s*-\s*(.+)$/)
      if (!item) break
      raw.push(item[1])
    }
  }

  return normalizeTags(raw)
}