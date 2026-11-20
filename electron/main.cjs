const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const { activeRenderer, checkRendererUpdate } = require('./desktop-updates.cjs')

// Ensure portable .exe always uses a fixed, permanent userData directory in %APPDATA%\DemirturkPortfoy
app.setName('Demirtürk Portföy')
if (process.platform === 'win32') {
  app.setAppUserModelId('com.demirturk.portfoy')
}
const permanentUserDataDir = app.commandLine.getSwitchValue('user-data-dir') || path.join(app.getPath('appData'), 'DemirturkPortfoy')
try {
  if (!fs.existsSync(permanentUserDataDir)) {
    fs.mkdirSync(permanentUserDataDir, { recursive: true })
  }
  app.setPath('userData', permanentUserDataDir)
} catch (err) {
  console.error('Failed to set permanent userData path:', err)
}

const persistentDbPath = path.join(permanentUserDataDir, 'demirturk_persistent_db.json')
let diskStoreCache = null

function loadDiskStore() {
  if (diskStoreCache !== null) return diskStoreCache
  let localObj = {}
  try {
    if (fs.existsSync(persistentDbPath)) {
      const raw = fs.readFileSync(persistentDbPath, 'utf-8')
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        localObj = parsed
      }
    }
  } catch (err) {
    console.error('Failed to read persistent disk store:', err)
  }

  diskStoreCache = localObj
  return diskStoreCache
}

let saveTimer = null
function flushDiskStoreToFile() {
  if (!diskStoreCache) return
  try {
    if (!fs.existsSync(permanentUserDataDir)) {
      fs.mkdirSync(permanentUserDataDir, { recursive: true })
    }
    const tempPath = persistentDbPath + '.tmp'
    fs.writeFileSync(tempPath, JSON.stringify(diskStoreCache), 'utf-8')
    fs.renameSync(tempPath, persistentDbPath)
  } catch (err) {
    console.error('Failed to write persistent disk store:', err)
  }
}

function scheduleFlushDiskStore() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    flushDiskStoreToFile()
  }, 80)
}

// IPC handlers for permanent disk storage (shared between Electron .exe and localhost:9001)
ipcMain.on('disk-store-read-sync', (event) => {
  event.returnValue = loadDiskStore()
})

ipcMain.on('disk-store-write-key', (_event, key, value) => {
  const store = loadDiskStore()
  store[key] = value
  scheduleFlushDiskStore()
})

ipcMain.on('disk-store-remove-key', (_event, key) => {
  const store = loadDiskStore()
  delete store[key]
  scheduleFlushDiskStore()
})

ipcMain.on('disk-store-replace-all', (_event, newStore) => {
  if (newStore && typeof newStore === 'object') {
    diskStoreCache = { ...newStore }
    flushDiskStoreToFile()
  }
})

const bundledDistDir = path.join(__dirname, '../dist')
const updateCacheDir = path.join(permanentUserDataDir, 'desktop-updates-v1')
let renderer = { index: path.join(bundledDistDir, 'index.html'), buildTime: 0 }
let lastOtaStatus = { state: 'idle', versionId: app.getVersion(), buildTime: 0, lastCheckedAt: null, source: null }
let checkingUpdate

function notifyOtaStatus(patch) {
  lastOtaStatus = { ...lastOtaStatus, ...patch }
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ota-status-changed', lastOtaStatus)
}

function checkAndApplyOtaUpdate(reload = false) {
  if (process.env.VITE_DEV_SERVER_URL) return Promise.resolve({ updated: false })
  if (checkingUpdate) return checkingUpdate
  checkingUpdate = (async () => {
    let updated = false
    notifyOtaStatus({ state: 'checking', lastCheckedAt: new Date().toISOString() })
    try {
      renderer = await activeRenderer(bundledDistDir, updateCacheDir)
      const next = await checkRendererUpdate({
        cacheDir: updateCacheDir, active: renderer,
        onDownload: () => notifyOtaStatus({ state: 'downloading', source: 'github' }),
      })
      updated = next.buildTime > renderer.buildTime
      renderer = next
      notifyOtaStatus({ state: updated ? 'updated' : 'up-to-date', buildTime: renderer.buildTime })
    } catch (error) {
      console.warn('[OTA]', error.message)
      notifyOtaStatus({ state: 'idle', buildTime: renderer.buildTime })
    }
    if (reload && updated && mainWindow && !mainWindow.isDestroyed()) {
      flushDiskStoreToFile()
      await loadRenderer(mainWindow)
    }
    return { updated, versionId: lastOtaStatus.versionId }
  })().finally(() => { checkingUpdate = undefined })
  return checkingUpdate
}

async function loadRenderer(win) {
  if (win.isDestroyed()) return
  const bundled = path.join(bundledDistDir, 'index.html')
  try {
    await win.loadFile(renderer.index)
  } catch (error) {
    if (renderer.index === bundled || win.isDestroyed()) throw error
    await win.loadFile(bundled)
  }
}

ipcMain.handle('ota-check-now', () => checkAndApplyOtaUpdate(true))
ipcMain.handle('ota-get-status', () => lastOtaStatus)

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#34302c',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    show: false,
  })

  // Smooth window reveal once ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // F5 & Ctrl+R / Command+R reload support + OTA check
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      if (input.key === 'F5' || ((input.control || input.meta) && input.key.toLowerCase() === 'r')) {
        flushDiskStoreToFile()
        checkAndApplyOtaUpdate(true).then((res) => {
          if (!res.updated && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.reloadIgnoringCache()
          }
        })
        event.preventDefault()
      }
    }
  })

  // Window control IPC listeners
  ipcMain.on('window-minimize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.minimize()
    }
  })

  ipcMain.on('window-maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize()
      } else {
        mainWindow.maximize()
      }
    }
  })

  ipcMain.on('window-close', () => {
    flushDiskStoreToFile()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close()
    }
  })

  ipcMain.handle('window-is-maximized', () => {
    return mainWindow && !mainWindow.isDestroyed() ? mainWindow.isMaximized() : false
  })

  mainWindow.on('maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-maximize-changed', true)
    }
  })

  mainWindow.on('unmaximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-maximize-changed', false)
    }
  })

  // Prevent navigation to external urls inside app window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  const win = mainWindow
  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    void win.loadURL(devUrl)
  } else {
    void (async () => {
      const splash = win.loadFile(path.join(__dirname, 'startup.html'))
      await Promise.all([splash, checkAndApplyOtaUpdate()])
      await loadRenderer(win)
    })().catch(error => {
      if (!win.isDestroyed()) {
        require('electron').dialog.showErrorBox('Portföy açılamadı', 'Uygulama dosyaları yüklenemedi. Portföy’ü yeniden açın.')
      }
      console.error('Portföy başlatılamadı:', error.message)
    })
  }

  mainWindow.on('close', () => {
    flushDiskStoreToFile()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    // Chromium serializes header values as bytes. Keep the product token ASCII.
    app.userAgentFallback = app.userAgentFallback
      .replace(/Demirtürk\s*Portföy/gi, 'DemirturkPortfoy')
      .replace(/[^\x20-\x7e]/g, '')
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('before-quit', () => {
  flushDiskStoreToFile()
})

app.on('window-all-closed', () => {
  flushDiskStoreToFile()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
