/** True if `p` is `target` itself or something inside the `target` folder */
export function isInside(p: string | null | undefined, target: string): boolean {
  if (!p) return false
  return p === target || p.startsWith(target + '/') || p.startsWith(target + '\\')
}
/** Resolve a relative link (e.g. "../Other/note.md") against the file it appears in */
export function resolveRelative(fromFile: string, rel: string): string {
  const sep = fromFile.includes('\\') ? '\\' : '/'
  const parts = fromFile.split(/[\\/]/)
  parts.pop() // drop the current file name
  for (const seg of rel.split(/[\\/]/)) {
    if (!seg || seg === '.') continue
    if (seg === '..') parts.pop()
    else parts.push(seg)
  }
  return parts.join(sep)
}

/** An absolute file path as a luna-file:// URL the preview can load (only works inside the notes folder) */
export function toFileUrl(absPath: string): string {
  const p = absPath.replace(/\\/g, '/')
  return 'luna-file://local' + (p.startsWith('/') ? '' : '/') + p.split('/').map(encodeURIComponent).join('/')
}

/** Where an image in a note really points: web/data URLs as-is, relative paths into the notes folder */
export function imageSrc(src: string | undefined, notePath: string | undefined): string | undefined {
  if (!src || /^[a-z][a-z0-9+.-]*:/i.test(src) || !notePath) return src
  let rel = src
  try {
    rel = decodeURIComponent(src)
  } catch {
    // not encoded
  }
  return toFileUrl(resolveRelative(notePath, rel))
}
