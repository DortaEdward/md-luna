import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

import { registerIpc } from './ipc'
import { ensureAegisRoot } from './Aegis'
import { handleFileScheme, registerFileScheme } from './Aegis/attachments'

// Must match `appId` in electron-builder.yml
const APP_ID = 'com.edwarddorta.lunamd'

// Keep using the data folder from before the rename (favorites, settings, preferences).
// Must run before the app is ready. Remove this line to start with a fresh data folder.
app.setPath('userData', join(app.getPath('appData'), 'luna-md-desktop'))

// Lets the preview show images stored in the notes folder (luna-file://)
registerFileScheme()

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 1080,
    minHeight: 760,
    show: false,
    title: 'Luna MD',
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 14 },
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = new URL(mainWindow!.webContents.getURL())
    const next = new URL(url)
    if (next.origin !== current.origin) {
      event.preventDefault()
      if (/^(https?|mailto):$/.test(next.protocol)) shell.openExternal(url)
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId(APP_ID)

  if (process.platform === 'darwin') {
    app.dock?.setIcon(icon)
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  await ensureAegisRoot()
  handleFileScheme()
  registerIpc(() => mainWindow)

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})