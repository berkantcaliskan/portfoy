const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const zlib = require('zlib')

// Ensure portable .exe always uses a fixed, permanent userData directory in %APPDATA%\DemirturkPortfoy
app.setName('Demirtürk Portföy')
if (process.platform === 'win32') {
  app.setAppUserModelId('com.demirturk.portfoy')
}
const permanentUserDataDir = path.join(app.getPath('appData'), 'DemirturkPortfoy')
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
  try {
    if (fs.existsSync(persistentDbPath)) {
      const raw = fs.readFileSync(persistentDbPath, 'utf-8')
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        diskStoreCache = parsed
        return diskStoreCache
      }
    }
  } catch (err) {
    console.error('Failed to read persistent disk store:', err)
  }
  diskStoreCache = {}
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

// ============================================================================
// AUTOMATIC GITHUB + CLOUD OTA (OVER-THE-AIR) AUTO-UPDATER
// Automatically pulls latest build from GitHub (berkantcaliskan/portfoy)
// and updates all running/launched portföyapp.exe instances without USB sticks.
// ============================================================================
const SUPABASE_URL = 'https://qspefqddkddxobfxxmqa.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzcGVmcWRka2RkeG9iZnh4bXFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NzI4NjksImV4cCI6MjA5MDU0ODg2OX0.f1A3WG3-efXbjb8-D326227-j-0m27441V5yT2I2tPg'
const GITHUB_REPO = 'berkantcaliskan/portfoy'
const GITHUB_BRANCH = 'main'

const bundledDistDir = path.join(__dirname, '../dist')
const userOtaDistDir = path.join(permanentUserDataDir, 'ota-dist')

let isCheckingOta = false
let lastOtaStatus = {
  state: 'idle',
  versionId: readLocalOtaVersion().versionId || 'v1.0.0',
  buildTime: readLocalOtaVersion().buildTime || 0,
  lastCheckedAt: null,
  source: null,
}

function readVersionFile(dir) {
  try {
    const p = path.join(dir, 'ota-version.json')
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'))
    }
  } catch {}
  return { versionId: 'v1.0.0', buildTime: 0 }
}

function readLocalOtaVersion() {
  const vBundled = readVersionFile(bundledDistDir)
  const vUser = readVersionFile(userOtaDistDir)
  return (vUser.buildTime || 0) > (vBundled.buildTime || 0) ? vUser : vBundled
}

function getActiveDistIndexHtml() {
  const vBundled = readVersionFile(bundledDistDir)
  const vUser = readVersionFile(userOtaDistDir)
  const userIndex = path.join(userOtaDistDir, 'index.html')
  const bundledIndex = path.join(bundledDistDir, 'index.html')

  if ((vUser.buildTime || 0) > (vBundled.buildTime || 0) && fs.existsSync(userIndex)) {
    return userIndex
  }
  if (fs.existsSync(bundledIndex)) {
    return bundledIndex
  }
  if (fs.existsSync(userIndex)) {
    return userIndex
  }
  return bundledIndex
}

function notifyOtaStatus(patch) {
  lastOtaStatus = { ...lastOtaStatus, ...patch }
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send('ota-status-changed', lastOtaStatus)
    } catch {}
  }
}

async function fetchSupabaseSetting(key) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/app_settings?key=eq.${encodeURIComponent(key)}&select=value`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    )
    if (!res.ok) return null
    const rows = await res.json()
    return rows && rows[0] ? rows[0].value : null
  } catch {
    return null
  }
}

async function resolveGitHubToken() {
  try {
    const ghCfg = await fetchSupabaseSetting('demirturk_ota_gh_config_v1')
    if (ghCfg && ghCfg.tokenB64) {
      return Buffer.from(ghCfg.tokenB64, 'base64').toString('utf-8').trim()
    }
  } catch {}
  return ''
}

async function fetchFromGitHubRepo(filePath, ghToken) {
  const headers = {
    Accept: 'application/vnd.github.v3.raw',
    'User-Agent': 'DemirturkPortfoy-OTA-Updater',
  }
  if (ghToken) {
    headers.Authorization = `Bearer ${ghToken}`
  }
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}?ref=${GITHUB_BRANCH}&t=${Date.now()}`
  const res = await fetch(url, { headers })
  if (!res.ok) return null
  return await res.json()
}

function writeUnpackedBundleToDir(targetDir, bundle) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
  }

  // Copy static assets (fonts, backgrounds, icons) from bundledDistDir if targetDir is userOtaDistDir
  if (targetDir === userOtaDistDir && fs.existsSync(bundledDistDir)) {
    for (const item of fs.readdirSync(bundledDistDir)) {
      if (item === 'assets' || item === 'index.html' || item.startsWith('ota-')) continue
      const srcPath = path.join(bundledDistDir, item)
      const destPath = path.join(targetDir, item)
      if (!fs.existsSync(destPath)) {
        try {
          fs.cpSync(srcPath, destPath, { recursive: true })
        } catch {}
      }
    }
  }

  const assetsDir = path.join(targetDir, 'assets')
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true })
  }

  for (const [relPath, gzBase64] of Object.entries(bundle.files || {})) {
    const destFile = path.join(targetDir, relPath)
    const destParent = path.dirname(destFile)
    if (!fs.existsSync(destParent)) {
      fs.mkdirSync(destParent, { recursive: true })
    }
    const rawBuffer = zlib.gunzipSync(Buffer.from(gzBase64, 'base64'))
    fs.writeFileSync(destFile, rawBuffer)
  }

  const versionMeta = {
    versionId: bundle.versionId,
    buildTime: bundle.buildTime,
    buildIso: bundle.buildIso,
    fileCount: bundle.fileCount,
    repo: GITHUB_REPO,
  }
  fs.writeFileSync(
    path.join(targetDir, 'ota-version.json'),
    JSON.stringify(versionMeta, null, 2),
    'utf-8'
  )
}

async function checkAndApplyOtaUpdate(forceReloadIfUpdated = true) {
  if (isCheckingOta || process.env.VITE_DEV_SERVER_URL) return { updated: false }
  isCheckingOta = true
  notifyOtaStatus({ state: 'checking', lastCheckedAt: new Date().toISOString() })

  try {
    const localVer = readLocalOtaVersion()
    const ghToken = await resolveGitHubToken()

    // 1. Check GitHub (berkantcaliskan/portfoy) first, then Supabase mirror
    let remoteVer = await fetchFromGitHubRepo('dist/ota-version.json', ghToken)
    let source = 'github'

    const supaVer = await fetchSupabaseSetting('demirturk_ota_version_v1')
    if (!remoteVer || (supaVer && (supaVer.buildTime || 0) > (remoteVer.buildTime || 0))) {
      if (supaVer && supaVer.buildTime) {
        remoteVer = supaVer
        source = 'github-mirror'
      }
    }

    if (!remoteVer || !remoteVer.buildTime || remoteVer.buildTime <= (localVer.buildTime || 0)) {
      notifyOtaStatus({
        state: 'up-to-date',
        versionId: localVer.versionId || 'v1.0.0',
        buildTime: localVer.buildTime || 0,
        lastCheckedAt: new Date().toISOString(),
      })
      isCheckingOta = false
      return { updated: false, versionId: localVer.versionId }
    }

    // 2. Newer version detected! Download bundle from GitHub (or mirror)
    notifyOtaStatus({
      state: 'downloading',
      versionId: remoteVer.versionId,
      source,
    })

    let bundle = null
    if (source === 'github') {
      bundle = await fetchFromGitHubRepo('dist/ota-bundle.json', ghToken)
    }
    if (!bundle || !bundle.files) {
      bundle = await fetchSupabaseSetting('demirturk_ota_bundle_v1')
    }

    if (!bundle || !bundle.files) {
      notifyOtaStatus({ state: 'up-to-date' })
      isCheckingOta = false
      return { updated: false }
    }

    // 3. Write updated files directly to bundledDistDir AND userOtaDistDir
    try {
      writeUnpackedBundleToDir(bundledDistDir, bundle)
    } catch (e) {
      console.warn('[OTA] Could not write to bundledDistDir, using userOtaDistDir:', e.message)
    }
    try {
      writeUnpackedBundleToDir(userOtaDistDir, bundle)
    } catch (e) {
      console.warn('[OTA] Could not write to userOtaDistDir:', e.message)
    }

    notifyOtaStatus({
      state: 'updated',
      versionId: bundle.versionId,
      buildTime: bundle.buildTime,
      lastCheckedAt: new Date().toISOString(),
      source,
    })

    // 4. Flush persistent DB and reload window seamlessly
    if (forceReloadIfUpdated && mainWindow && !mainWindow.isDestroyed()) {
      flushDiskStoreToFile()
      const targetHtml = getActiveDistIndexHtml()
      if (fs.existsSync(targetHtml)) {
        mainWindow.loadFile(targetHtml)
      } else {
        mainWindow.webContents.reloadIgnoringCache()
      }
    }

    isCheckingOta = false
    return { updated: true, versionId: bundle.versionId }
  } catch (err) {
    console.warn('[OTA] Auto-update check error:', err.message)
    notifyOtaStatus({ state: 'idle' })
    isCheckingOta = false
    return { updated: false, error: err.message }
  }
}

ipcMain.handle('ota-check-now', async () => {
  return await checkAndApplyOtaUpdate(true)
})

ipcMain.handle('ota-get-status', () => {
  return {
    ...lastOtaStatus,
    ...readLocalOtaVersion(),
  }
})

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
      sandbox: false,
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

  // Decide whether to load dev server or latest OTA / bundled production file
  const activeDistHtml = getActiveDistIndexHtml()
  const devUrl = process.env.VITE_DEV_SERVER_URL

  if (devUrl) {
    mainWindow.loadURL(devUrl)
  } else if (fs.existsSync(activeDistHtml)) {
    mainWindow.loadFile(activeDistHtml)
  } else {
    mainWindow.loadURL('http://localhost:9001')
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
    createWindow()

    // Check GitHub & Cloud OTA immediately on startup and every 45 seconds
    setTimeout(() => {
      checkAndApplyOtaUpdate(true)
    }, 1500)

    setInterval(() => {
      checkAndApplyOtaUpdate(true)
    }, 45000)

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
