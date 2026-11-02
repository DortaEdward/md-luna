import { contextBridge, ipcRenderer, IpcRendererEvent, webUtils } from 'electron'
import { CH, Note } from '../shared/types/shared'
import { Aegis } from '../shared/types/aegis.types'

/** Subscribe to a main-process event; returns an unsubscribe function */
function listen<T extends unknown[]>(channel: string, cb: (...args: T) => void) {
  const handler = (_e: IpcRendererEvent, ...args: unknown[]) => cb(...(args as T))
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}

const api = {
  window: {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    setTheme: (mode: 'system' | 'light' | 'dark') => ipcRenderer.send('theme:set', mode)
  },

  settings: {
    getNotesRoot: () => ipcRenderer.invoke('settings:getNotesRoot') as Promise<string>,
    chooseNotesRoot: () => ipcRenderer.invoke('settings:chooseNotesRoot') as Promise<string | null>,
    revealNotesRoot: () => ipcRenderer.invoke('settings:revealNotesRoot') as Promise<string>,
    relaunch: () => ipcRenderer.send('app:relaunch'),
    getUserName: () => ipcRenderer.invoke('system:getUserName') as Promise<string>
  },

  aegis: {
    /* ----- notebooks ----- */
    getTree: () => ipcRenderer.invoke('fs:getTree') as Promise<Aegis[]>,
    createAegis: (parentDir?: string) =>
      ipcRenderer.invoke('fs:makeDir', parentDir) as Promise<string>,
    showSidebarItemMenu: (aegisPath: string) => ipcRenderer.send('menu:item', aegisPath),
    moveAegis: (aegisPath: string, destParentPath: string) =>
      ipcRenderer.invoke('fs:moveAegis', aegisPath, destParentPath) as Promise<string>,
    listTags: () => ipcRenderer.invoke('fs:listTags') as Promise<{ name: string; count: number }[]>,

    /* ----- notes ----- */
    listNotes: (aegisPath: string) =>
      ipcRenderer.invoke('fs:listNotes', aegisPath) as Promise<Note[]>,
    listAllNotes: () => ipcRenderer.invoke('fs:listAllNotes') as Promise<Note[]>,
    readNote: (notePath: string) => ipcRenderer.invoke('fs:readNote', notePath) as Promise<string>,
    writeNote: (notePath: string, content: string) =>
      ipcRenderer.invoke('fs:writeNote', notePath, content) as Promise<void>,
    createNote: (aegisPath: string) =>
      ipcRenderer.invoke('fs:createNote', aegisPath) as Promise<string>,
    moveNote: (notePath: string, destAegisPath: string) =>
      ipcRenderer.invoke('fs:moveNote', notePath, destAegisPath) as Promise<string>,
    saveImage: async (notePath: string, file: File) =>
      ipcRenderer.invoke(
        'fs:saveImage',
        notePath,
        file.name,
        file.type,
        new Uint8Array(await file.arrayBuffer())
      ) as Promise<string>,
    showNoteMenu: (notePath: string) => ipcRenderer.send('menu:note', notePath),

    /* ----- notes and notebooks ----- */
    rename: (itemPath: string, newName: string) =>
      ipcRenderer.invoke('fs:rename', itemPath, newName) as Promise<string>,

    /* ----- import ----- */
    importNotes: (aegisPath: string, filePaths?: string[]) =>
      ipcRenderer.invoke('fs:importNotes', aegisPath, filePaths) as Promise<string[]>,
    getPathForFile: (file: File) => webUtils.getPathForFile(file),

    /* ----- favorites ----- */
    getFavorites: () => ipcRenderer.invoke('fs:getFavorites') as Promise<string[]>,
    setFavorite: (notePath: string, on: boolean) =>
      ipcRenderer.invoke('fs:setFavorite', notePath, on) as Promise<string[]>,

    /* ----- export ----- */
    exportNote: (notePath: string, title: string, bodyHtml: string, format: 'pdf' | 'html') =>
      ipcRenderer.invoke('export:note', notePath, title, bodyHtml, format) as Promise<string | null>,
    showExportMenu: (notePath: string) => ipcRenderer.send('menu:export', notePath),
    onExportRequest: (cb: (notePath: string, format: 'pdf' | 'html') => void) =>
      listen<[string, 'pdf' | 'html']>('export:request', cb),

    /* ----- links ----- */
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url) as Promise<void>,

    /* ----- events from the main process ----- */
    onFsChanged: (cb: () => void) => listen(CH.FS_CHANGED, cb),
    onRenameRequest: (cb: (itemPath: string) => void) => listen<[string]>(CH.RENAME_REQUEST, cb),
    onFavoritesChanged: (cb: () => void) => listen('favorites:changed', cb),
    onTrashing: (cb: (path: string) => void) => listen<[string]>('fs:trashing', cb),
    onAegisCreated: (cb: (path: string) => void) => listen<[string]>('aegis:created', cb),
    onAegisMoved: (cb: (oldPath: string, newPath: string) => void) =>
      listen<[string, string]>('aegis:moved', cb)
  }
}

contextBridge.exposeInMainWorld('api', api)
export type Api = typeof api