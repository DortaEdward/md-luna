import { app } from 'electron'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import writeFileAtomic from 'write-file-atomic'

type MainSettings = { notesRoot?: string }

let cache: MainSettings | null = null
const filePath = () => path.join(app.getPath('userData'), 'settings.json')

function load(): MainSettings {
  if (!cache) {
    try {
      cache = JSON.parse(readFileSync(filePath(), 'utf8'))
    } catch {
      cache = {} // first run, nothing saved yet
    }
  }
  return cache!
}

/** The folder the user picked in Settings, or undefined to use the default */
export function getNotesRootOverride(): string | undefined {
  return load().notesRoot
}

export function setNotesRoot(dir: string) {
  load().notesRoot = dir
  writeFileAtomic.sync(filePath(), JSON.stringify(cache, null, 2), 'utf8')
}