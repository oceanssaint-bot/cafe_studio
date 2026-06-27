import { app, shell, BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import { join } from 'path'
import { initDatabase, closeDatabase } from './db'
import { registerIpcHandlers } from './ipc'

// If launched from a shell where ELECTRON_RUN_AS_NODE is set, Electron behaves
// as plain Node and never opens a window. Relaunch the real Electron binary
// with the variable cleared, then exit this process. (Normal launches never
// set the variable, so this guard is a no-op for end users.)
if (process.env.ELECTRON_RUN_AS_NODE) {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  spawn(process.execPath, process.argv.slice(1), {
    env,
    detached: true,
    stdio: 'ignore'
  }).unref()
  app.quit?.()
  process.exit(0)
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'Cafe Studio',
    backgroundColor: '#f7f3ee',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // electron-vite injects the dev server URL in development; in production we
  // load the built renderer from disk.
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Initialise SQLite before any window can request data.
  try {
    initDatabase()
  } catch (err) {
    // Surface init failure to the main-process console; the renderer will also
    // see it via the db:status IPC channel.
    console.error('Failed to initialise database:', err)
  }

  registerIpcHandlers()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  closeDatabase()
})
