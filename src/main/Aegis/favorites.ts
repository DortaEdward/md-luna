import { app } from 'electron'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import writeFileAtomic from 'write-file-atomic'

const filePath = () => path.join(app.getPath('userData'), 'favorites.json')
let favorites: Set<string> | null = null

async function load(): Promise<Set<string>> {
  if (favorites) return favorites
  try {
    const data = JSON.parse(await readFile(filePath(), 'utf8'))
    favorites = new Set(Array.isArray(data) ? data.filter((x) => typeof x === 'string') : [])
  } catch {
    favorites = new Set() // first run, or unreadable file
  }
  return favorites
}

async function save() {
  await writeFileAtomic(filePath(), JSON.stringify([...(favorites ?? [])], null, 2), 'utf8')
}

const isInside = (p: string, target: string) => p === target || p.startsWith(target + path.sep)

export async function getFavorites(): Promise<string[]> {
  return [...(await load())]
}

export async function setFavorite(notePath: string, on: boolean): Promise<string[]> {
  const f = await load()
  if (on) f.add(notePath)
  else f.delete(notePath)
  await save()
  return [...f]
}

/** Keep favorites pointing at the right place after a file or folder is renamed/moved */
export async function renameFavoritePath(oldPath: string, newPath: string) {
  const f = await load()
  let changed = false
  for (const p of [...f]) {
    if (isInside(p, oldPath)) {
      f.delete(p)
      f.add(newPath + p.slice(oldPath.length))
      changed = true
    }
  }
  if (changed) await save()
}

/** Drop favorites for a trashed file, or for every file in a trashed folder */
export async function removeFavoritePath(target: string) {
  const f = await load()
  let changed = false
  for (const p of [...f]) {
    if (isInside(p, target)) {
      f.delete(p)
      changed = true
    }
  }
  if (changed) await save()
}