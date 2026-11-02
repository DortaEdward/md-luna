// main/aegis.ts
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { isErrnoException, getAegisRoot } from '../Utils'

let aegis: string | null = null

export async function ensureAegisRoot(): Promise<string> {
  const root = getAegisRoot()
  await mkdir(root, { recursive: true })
  return root
}

export const requireAegis = () => {
  if (!aegis) throw new Error('No Aegis selected')
  return aegis
}

export async function makeAegis(basePath: string, dirName = 'Untitled'): Promise<string> {
  // loop through dir to see if name is taken
  for (let i = 0; ; i++) {
    const fullPath = path.join(basePath, i === 0 ? dirName : `${dirName} ${i}`)
    try {
      // attempt to make the file
      await mkdir(fullPath)
      // return the file path
      return fullPath
    } catch (e) {
      if (!isErrnoException(e) || e.code !== 'EEXIST') throw e // only retry if the name is taken
    }
  }
}
