import { mkdir, writeFile, readFile, copyFile, constants } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { net, protocol } from 'electron'
import { isErrnoException } from '../Utils'
import { inRoot } from './paths'
import { ATTACHMENTS_DIR } from '../../shared/tree'

/*
 * Images in notes.
 * Pasted or dropped images are saved next to the note, in an "_attachments"
 * folder inside its notebook, and linked with a relative path:
 *   ![](_attachments/screenshot-2026-11-02.png)
 * The preview loads them through the luna-file:// protocol, which only serves
 * files inside the notes folder.
 */

export const FILE_SCHEME = 'luna-file'

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i
const MIME_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/avif': '.avif',
  'image/bmp': '.bmp'
}
const MAX_IMAGE_BYTES = 50 * 1024 * 1024

function stamp(): string {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

/** A safe, link-friendly file name: "My Screenshot (1).PNG" → "my-screenshot-1.png" */
function cleanName(name: string, mime: string): string {
  const ext = (path.extname(name).match(IMAGE_EXT) ? path.extname(name) : MIME_EXT[mime] ?? '.png').toLowerCase()
  let base = path
    .basename(name, path.extname(name))
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
  // Clipboard screenshots are all called "image.png": give them a date instead
  if (!base || base === 'image') base = `pasted-image-${stamp()}`
  return base.slice(0, 80) + ext
}

/** Save image bytes for a note. Returns the relative link to put in the note. */
export async function saveImage(
  notePath: string,
  fileName: string,
  mime: string,
  bytes: Uint8Array
): Promise<string> {
  if (!mime.startsWith('image/') && !IMAGE_EXT.test(fileName)) throw new Error('Not an image')
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error('Image is larger than 50 MB')

  const noteAbs = inRoot(notePath)
  const dir = path.join(path.dirname(noteAbs), ATTACHMENTS_DIR)
  await mkdir(dir, { recursive: true })

  const name = cleanName(fileName, mime)
  const ext = path.extname(name)
  const base = path.basename(name, ext)
  for (let i = 0; i < 1000; i++) {
    const finalName = (i === 0 ? base : `${base}-${i}`) + ext
    try {
      await writeFile(path.join(dir, finalName), bytes, { flag: 'wx' })
      return `${ATTACHMENTS_DIR}/${finalName}`
    } catch (e) {
      if (!isErrnoException(e) || e.code !== 'EEXIST') throw e
    }
  }
  throw new Error('No free file name for the image')
}

/**
 * A note moved to another notebook: copy the images it links to into the new
 * notebook's _attachments folder so the links keep working. (Copied, not moved:
 * other notes may use the same image.)
 */
export async function copyNoteImages(fromDir: string, toNotePath: string): Promise<void> {
  const toDir = path.dirname(toNotePath)
  if (fromDir === toDir) return
  const text = await readFile(toNotePath, 'utf8')
  const re = new RegExp(`\\]\\(<?(${ATTACHMENTS_DIR}/[^)>\\s]+)`, 'g')
  const rels = [...new Set([...text.matchAll(re)].map((m) => m[1]))]
  if (!rels.length) return

  await mkdir(path.join(toDir, ATTACHMENTS_DIR), { recursive: true })
  for (const rel of rels) {
    let name = rel
    try {
      name = decodeURIComponent(rel)
    } catch {
      // not encoded
    }
    if (name.includes('..')) continue
    try {
      await copyFile(path.join(fromDir, name), path.join(toDir, name), constants.COPYFILE_EXCL)
    } catch {
      // already there, or the image is missing
    }
  }
}

/** luna-file://local/Users/me/Notes/x.png → /Users/me/Notes/x.png (or C:\...\x.png) */
export function fileUrlToPath(url: string): string {
  let p = decodeURIComponent(new URL(url).pathname)
  if (/^\/[A-Za-z]:\//.test(p)) p = p.slice(1) // Windows drive letter
  return path.normalize(p)
}

/** Must run before the app is ready */
export function registerFileScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: FILE_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
  ])
}

/** Serve files from the notes folder (and nowhere else) to the preview. Run after ready. */
export function handleFileScheme(): void {
  protocol.handle(FILE_SCHEME, async (request) => {
    try {
      const abs = inRoot(fileUrlToPath(request.url))
      return await net.fetch(pathToFileURL(abs).toString())
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}

/** For export: swap luna-file:// image links for the image data itself, so the file stands alone */
export async function inlineImages(html: string): Promise<string> {
  const re = new RegExp(`src="(${FILE_SCHEME}://[^"]+)"`, 'g')
  const urls = [...new Set([...html.matchAll(re)].map((m) => m[1]))]
  const data = new Map<string, string>()

  await Promise.all(
    urls.map(async (url) => {
      try {
        const abs = inRoot(fileUrlToPath(url.replace(/&amp;/g, '&')))
        const ext = path.extname(abs).toLowerCase()
        const mime =
          Object.entries(MIME_EXT).find(([, e]) => e === ext || (ext === '.jpeg' && e === '.jpg'))?.[0] ??
          'application/octet-stream'
        data.set(url, `data:${mime};base64,${(await readFile(abs)).toString('base64')}`)
      } catch {
        // missing image: leave the link as it is
      }
    })
  )

  return html.replace(re, (whole, url) => (data.has(url) ? `src="${data.get(url)}"` : whole))
}
