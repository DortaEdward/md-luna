import { ipcMain, app, BrowserWindow, Menu, shell, dialog, nativeTheme } from 'electron'
import { execFile } from 'node:child_process'
import os from 'node:os'
import { promisify } from 'node:util'
import { promises as fs } from 'fs'
import path from 'path'
import { getAegisRoot } from '../Utils'
import { makeAegis } from '../Aegis'
import { setNotesRoot } from '../Aegis/settings'
import {
  getFavorites,
  removeFavoritePath,
  renameFavoritePath,
  setFavorite
} from '../Aegis/favorites'
import { inRoot } from '../Aegis/paths'
import {
  getTree,
  listNotes,
  makeFile,
  readNote,
  moveFile,
  writeNote,
  importFiles,
  moveFolder
} from '../Aegis/files'
import { flattenAegis } from '../../shared/tree'
import { copyNoteImages, saveImage } from '../Aegis/attachments'
import { exportNote, type ExportFormat } from '../Aegis/exporter'
import { CH } from '../../shared/types/shared'

const FAVORITES_CHANGED = 'favorites:changed'
const TRASHING = 'fs:trashing'
const AEGIS_CREATED = 'aegis:created'
const AEGIS_MOVED = 'aegis:moved'
const EXPORT_REQUEST = 'export:request'
const run = promisify(execFile)

export function registerIpc(getWindow: () => BrowserWindow | null) {
  /* ---------- Window ---------- */

  ipcMain.on('window-minimize', () => getWindow()?.minimize())
  ipcMain.on('window-maximize', () => {
    const w = getWindow()
    w?.isMaximized() ? w.unmaximize() : w?.maximize()
  })
  ipcMain.on('window-close', () => getWindow()?.close())

  ipcMain.on('theme:set', (_e, mode: 'system' | 'light' | 'dark') => {
    nativeTheme.themeSource = mode // window chrome, menus and scrollbars follow
  })

  /* ---------- Notebooks & notes ---------- */

  ipcMain.handle('fs:getTree', () => getTree(getAegisRoot()))
  ipcMain.handle('fs:makeDir', async (e, basePath?: string) => {
    const created = await makeAegis(basePath ? inRoot(basePath) : getAegisRoot())
    e.sender.send(CH.FS_CHANGED)
    return created
  })
  ipcMain.handle('fs:listNotes', (_e, aegisPath: string) => listNotes(inRoot(aegisPath)))
  ipcMain.handle('fs:readNote', (_e, notePath: string) => readNote(inRoot(notePath)))
  ipcMain.handle('fs:writeNote', (_e, notePath: string, content: string) =>
    writeNote(inRoot(notePath), content)
  )

  ipcMain.handle('fs:listAllNotes', async () => {
    const all = flattenAegis(await getTree(getAegisRoot()))
    const groups = await Promise.all(all.map((a) => listNotes(a.path).catch(() => [])))
    return groups.flat().sort((a, b) => b.updatedAt - a.updatedAt)
  })

  ipcMain.handle('fs:createNote', async (e, aegisPath: string) => {
    const created = await makeFile(inRoot(aegisPath))
    e.sender.send(CH.FS_CHANGED)
    return created
  })

  ipcMain.handle('fs:rename', async (e, itemPath: string, newName: string) => {
    const name = newName.trim()
    if (!name || name === '.' || name === '..' || /[\\/]/.test(name)) {
      throw new Error('Invalid name')
    }

    const oldAbs = inRoot(itemPath)
    const stat = await fs.stat(oldAbs)

    const ext = stat.isFile() ? path.extname(oldAbs) : ''
    const finalName = ext && !name.toLowerCase().endsWith(ext.toLowerCase()) ? name + ext : name
    const newAbs = path.join(path.dirname(oldAbs), finalName)

    if (oldAbs === newAbs) return itemPath

    const isCaseOnly = oldAbs.toLowerCase() === newAbs.toLowerCase()
    if (!isCaseOnly) {
      const exists = await fs.access(newAbs).then(
        () => true,
        () => false
      )
      if (exists) throw new Error(`"${finalName}" already exists`)
    }

    await fs.rename(oldAbs, newAbs)
    await renameFavoritePath(oldAbs, newAbs) // keep favorites after renaming a note or notebook
    e.sender.send(CH.FS_CHANGED)
    e.sender.send(FAVORITES_CHANGED)

    return path.join(path.dirname(itemPath), finalName)
  })

  ipcMain.handle('fs:moveNote', async (e, notePath: string, destAegisPath: string) => {
    const src = inRoot(notePath)
    const destDir = inRoot(destAegisPath)
    if (path.dirname(src) === destDir) return notePath // already there

    const newPath = await moveFile(src, destDir)
    await copyNoteImages(path.dirname(src), newPath).catch(() => {}) // keep its images working
    await renameFavoritePath(src, newPath) // keep favorites after moving a note
    e.sender.send(CH.FS_CHANGED)
    e.sender.send(FAVORITES_CHANGED)
    return newPath
  })

  // Move a notebook into another notebook (or back to the top level)
  ipcMain.handle('fs:moveAegis', async (e, aegisPath: string, destParentPath: string) => {
    const src = inRoot(aegisPath)
    const destDir = inRoot(destParentPath)
    if (src === path.resolve(getAegisRoot()) || path.dirname(src) === destDir) return aegisPath // nothing to do
    if (destDir === src || destDir.startsWith(src + path.sep)) {
      throw new Error("A notebook can't go inside itself")
    }
    const newPath = await moveFolder(src, destDir)
    await renameFavoritePath(src, newPath)
    e.sender.send(CH.FS_CHANGED)
    e.sender.send(FAVORITES_CHANGED)
    return newPath
  })

  // Paste / drop an image into a note
  ipcMain.handle(
    'fs:saveImage',
    (_e, notePath: string, fileName: string, mime: string, bytes: Uint8Array) =>
      saveImage(notePath, fileName, mime, bytes)
  )

  /* ---------- Export ---------- */

  ipcMain.handle(
    'export:note',
    (e, notePath: string, title: string, bodyHtml: string, format: ExportFormat) => {
      inRoot(notePath) // only notes from the notes folder
      return exportNote(BrowserWindow.fromWebContents(e.sender), title, bodyHtml, format)
    }
  )

  // The toolbar's export button
  ipcMain.on('menu:export', (e, notePath: string) => {
    Menu.buildFromTemplate([
      { label: 'Export as PDF…', click: () => e.sender.send(EXPORT_REQUEST, notePath, 'pdf') },
      { label: 'Export as HTML…', click: () => e.sender.send(EXPORT_REQUEST, notePath, 'html') }
    ]).popup({ window: BrowserWindow.fromWebContents(e.sender) ?? undefined })
  })

  ipcMain.handle('fs:listTags', async () => {
    const all = flattenAegis(await getTree(getAegisRoot()))
    const groups = await Promise.all(all.map((a) => listNotes(a.path).catch(() => [])))

    const counts = new Map<string, number>()
    for (const note of groups.flat()) {
      for (const tag of note.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }

    return [...counts]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name))
  })

  ipcMain.handle('fs:importNotes', async (e, aegisPath: string, filePaths?: string[]) => {
    let sources = filePaths ?? []

    // No paths passed (button click): ask the user to pick files
    if (sources.length === 0) {
      const win = BrowserWindow.fromWebContents(e.sender)
      const options: Electron.OpenDialogOptions = {
        title: 'Import notes',
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]
      }
      const result = win
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options)
      if (result.canceled) return []
      sources = result.filePaths
    }

    sources = sources.filter((p) => /\.(md|markdown|txt)$/i.test(p))
    if (sources.length === 0) return []

    const imported = await importFiles(inRoot(aegisPath), sources)
    e.sender.send(CH.FS_CHANGED)
    return imported
  })

  /* ---------- Favorites ---------- */

  ipcMain.handle('fs:getFavorites', () => getFavorites())

  ipcMain.handle('fs:setFavorite', async (e, notePath: string, on: boolean) => {
    const list = await setFavorite(inRoot(notePath), on)
    e.sender.send(FAVORITES_CHANGED)
    return list
  })

  /* ---------- Settings ---------- */

  ipcMain.handle('settings:getNotesRoot', () => getAegisRoot())

  ipcMain.handle('settings:chooseNotesRoot', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const options: Electron.OpenDialogOptions = {
      title: 'Choose notes folder',
      buttonLabel: 'Use This Folder',
      properties: ['openDirectory', 'createDirectory']
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    const dir = result.filePaths[0]
    if (result.canceled || !dir) return null
    setNotesRoot(dir)
    return dir
  })

  ipcMain.handle('settings:revealNotesRoot', () => shell.openPath(getAegisRoot()))

  ipcMain.on('app:relaunch', () => {
    app.relaunch()
    app.exit(0)
  })

  // The user's name from the computer: full name on macOS, account name elsewhere
  let cachedUserName: string | null = null

  ipcMain.handle('system:getUserName', async () => {
    if (cachedUserName !== null) return cachedUserName
    let name = ''
    if (process.platform === 'darwin') {
      try {
        name = (await run('id', ['-F'])).stdout.trim() // e.g. "Edward Dorta"
      } catch {
        // fall through to the account name
      }
    }
    if (!name) {
      try {
        name = os.userInfo().username // e.g. "edwarddorta"
      } catch {
        name = ''
      }
    }
    cachedUserName = name
    return name
  })

  /* ---------- Context menus ---------- */

  // Right-click on a note
  ipcMain.on('menu:note', async (e, notePath: string) => {
    const abs = inRoot(notePath) // the note's full path
    const isFav = (await getFavorites()).includes(abs)

    const menu = Menu.buildFromTemplate([
      {
        label: isFav ? 'Remove from Favorites' : 'Add to Favorites',
        click: async () => {
          await setFavorite(abs, !isFav)
          e.sender.send(FAVORITES_CHANGED)
        }
      },
      {
        label: 'Rename',
        click: () => e.sender.send(CH.RENAME_REQUEST, notePath)
      },
      { type: 'separator' },
      { label: 'Export as PDF…', click: () => e.sender.send(EXPORT_REQUEST, notePath, 'pdf') },
      { label: 'Export as HTML…', click: () => e.sender.send(EXPORT_REQUEST, notePath, 'html') },
      { type: 'separator' },
      {
        label: 'Move to Trash',
        click: async () => {
          e.sender.send(TRASHING, abs) // let the app drop unsaved edits first
          await shell.trashItem(abs)
          await removeFavoritePath(abs)
          e.sender.send(CH.FS_CHANGED)
          e.sender.send(FAVORITES_CHANGED)
        }
      }
    ])

    menu.popup({ window: BrowserWindow.fromWebContents(e.sender) ?? undefined })
  })

  // Right-click on a notebook
  ipcMain.on(CH.ITEM_MENU, (e, aegisPath: string) => {
    const dir = inRoot(aegisPath) // the notebook folder's full path

    const menu = Menu.buildFromTemplate([
      {
        label: 'New Note',
        click: async () => {
          await makeFile(dir)
          e.sender.send(CH.FS_CHANGED)
        }
      },
      {
        label: 'New Notebook Inside',
        click: async () => {
          const created = await makeAegis(dir)
          e.sender.send(CH.FS_CHANGED)
          e.sender.send(AEGIS_CREATED, created) // the app opens the new notebook's name for editing
        }
      },
      ...(path.dirname(dir) !== path.resolve(getAegisRoot())
        ? [
            {
              label: 'Move to Top Level',
              click: async (): Promise<void> => {
                const newPath = await moveFolder(dir, getAegisRoot())
                await renameFavoritePath(dir, newPath)
                e.sender.send(AEGIS_MOVED, dir, newPath)
                e.sender.send(CH.FS_CHANGED)
                e.sender.send(FAVORITES_CHANGED)
              }
            }
          ]
        : []),
      {
        label: 'Rename',
        click: () => e.sender.send(CH.RENAME_REQUEST, aegisPath)
      },
      { type: 'separator' },
      {
        label: 'Move to Trash',
        click: async () => {
          e.sender.send(TRASHING, dir) // let the app drop unsaved edits first
          await shell.trashItem(dir)
          await removeFavoritePath(dir) // drop favorites for every note in the notebook
          e.sender.send(CH.FS_CHANGED)
          e.sender.send(FAVORITES_CHANGED)
        }
      }
    ])

    menu.popup({ window: BrowserWindow.fromWebContents(e.sender) ?? undefined })
  })

  /* ---------- Shell ---------- */

  ipcMain.handle('shell:openExternal', (_e, url: string) => {
    if (/^(https?|mailto):/i.test(url)) return shell.openExternal(url)
    return undefined
  })
}
