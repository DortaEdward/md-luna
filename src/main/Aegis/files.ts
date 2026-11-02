import {
  readdir,
  readFile,
  stat,
  writeFile,
  copyFile,
  constants,
  access,
  rename
} from 'node:fs/promises'
import path from 'node:path'
import { isErrnoException } from '../Utils'
import { Aegis } from '../../shared/types/aegis.types'
import { Note } from '../../shared/types/shared'
import writeFileAtomic from 'write-file-atomic'
import { parseTags, splitFrontMatter } from './frontmatter'
import { ATTACHMENTS_DIR } from '../../shared/tree'

const MAX_DEPTH = 8 // stop runaway nesting (or folder links that loop)

/** Notebooks are folders; notebooks inside notebooks are folders inside folders */
export async function getTree(root: string, depth = 0, trail: string[] = []): Promise<Aegis[]> {
  if (depth > MAX_DEPTH) return []
  const entries = await readdir(root, { withFileTypes: true })

  const aegis = await Promise.all(
    entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== ATTACHMENTS_DIR)
      .map(async (e): Promise<Aegis> => {
        const dir = path.join(root, e.name)
        const files = await readdir(dir)
        const here = [...trail, e.name]
        return {
          name: e.name,
          path: dir,
          noteCount: files.filter((f) => f.endsWith('.md')).length,
          children: await getTree(dir, depth + 1, here),
          depth,
          trail: here.join(' / ')
        }
      })
  )

  return aegis.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
}

/** Move a notebook (and everything in it) into another folder, picking a free name */
export async function moveFolder(src: string, destDir: string): Promise<string> {
  const base = path.basename(src)
  for (let i = 0; i < 1000; i++) {
    const dest = path.join(destDir, i === 0 ? base : `${base} ${i}`)
    const taken = await access(dest).then(
      () => true,
      () => false
    )
    if (!taken) {
      await rename(src, dest)
      return dest
    }
  }
  throw new Error(`No free folder name for "${base}" in ${destDir}`)
}
export async function moveFile(src: string, destDir: string): Promise<string> {
  const ext = path.extname(src)
  const base = path.basename(src, ext)

  for (let i = 0; i < 1000; i++) {
    const dest = path.join(destDir, (i === 0 ? base : `${base} ${i}`) + ext)
    const taken = await access(dest).then(
      () => true,
      () => false
    )
    if (!taken) {
      await rename(src, dest)
      return dest
    }
  }
  throw new Error(`No free file name for "${base}" in ${destDir}`)
}

const NEW_NOTE_TEMPLATE = '---\ntags: []\n---\n\n'

export async function makeFile(basePath: string, name = 'Untitled'): Promise<string> {
  for (let i = 0; i < 1000; i++) {
    const fileName = (i === 0 ? name : `${name} ${i}`) + '.md'
    const fullPath = path.join(basePath, fileName)
    try {
      await writeFile(fullPath, NEW_NOTE_TEMPLATE, { flag: 'wx' })
      return fullPath
    } catch (e) {
      if (!isErrnoException(e) || e.code !== 'EEXIST') throw e
    }
  }
  throw new Error(`No free file name for "${name}" in ${basePath}`)
}

export async function listNotes(dir: string): Promise<Note[]> {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.md'))

  const notes = await Promise.all(
    files.map(async (file) => {
      const fullPath = path.join(dir, file)
      const [content, info] = await Promise.all([readFile(fullPath, 'utf8'), stat(fullPath)])
      const { front, body } = splitFrontMatter(content)

      return {
        name: file.replace(/\.md$/, ''),
        path: fullPath,
        tags: parseTags(front),
        // Preview from the body only, so front matter doesn't show up as text
        preview: body
          .replace(/[#*_`>\[\]()-]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 120),
        updatedAt: info.mtimeMs
      }
    })
  )

  return notes.sort((a, b) => b.updatedAt - a.updatedAt)
}

export const readNote = (filePath: string) => readFile(filePath, 'utf8')
export const writeNote = (filePath: string, content: string) =>
  writeFileAtomic(filePath, content, 'utf8')

export async function importFiles(destDir: string, sources: string[]): Promise<string[]> {
  const imported: string[] = []

  for (const src of sources) {
    const base = path.basename(src, path.extname(src))

    for (let i = 0; i < 1000; i++) {
      const dest = path.join(destDir, (i === 0 ? base : `${base} ${i}`) + '.md')
      try {
        await copyFile(src, dest, constants.COPYFILE_EXCL)
        imported.push(dest)
        break
      } catch (e) {
        if (!isErrnoException(e) || e.code !== 'EEXIST') throw e
      }
    }
  }

  return imported
}
