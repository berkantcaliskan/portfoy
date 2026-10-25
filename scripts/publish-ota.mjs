import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import os from 'os'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')
const electronDir = path.join(rootDir, 'electron')
const dataDir = path.join(rootDir, 'data')

function exportSharedCompanyDb() {
  const appDataDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
  const dbPath = path.join(appDataDir, 'DemirturkPortfoy', 'demirturk_persistent_db.json')
  if (!fs.existsSync(dbPath)) return null

  try {
    const rawDb = JSON.parse(fs.readFileSync(dbPath, 'utf-8'))
    const sharedDb = {}
    const skipKeys = new Set(['demirturk_active_user_v2', 'demirturk_logged_out'])
    for (const [k, v] of Object.entries(rawDb)) {
      if (!skipKeys.has(k) && typeof v === 'string') {
        sharedDb[k] = v
      }
    }

    // 1. Write data/cloud_db.json for live multi-PC GitHub sync
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    fs.writeFileSync(
      path.join(dataDir, 'cloud_db.json'),
      JSON.stringify(sharedDb, null, 2),
      'utf-8'
    )

    // 2. Write dist/shared-db.json so bundled/OTA dist also has it
    if (fs.existsSync(distDir)) {
      fs.writeFileSync(
        path.join(distDir, 'shared-db.json'),
        JSON.stringify(sharedDb),
        'utf-8'
      )
    }

    // 3. Keep src/services/seedCompanyData.ts up to date
    const seedTsPath = path.join(rootDir, 'src', 'services', 'seedCompanyData.ts')
    fs.writeFileSync(
      seedTsPath,
      'export const SEED_COMPANY_DB: Record<string, string> = ' +
        JSON.stringify(sharedDb, null, 2) +
        '\n',
      'utf-8'
    )

    return sharedDb
  } catch (err) {
    console.warn('[OTA] Warning exporting shared company DB:', err.message)
    return null
  }
}

function collectDistFiles() {
  const files = {}

  // 1. index.html & shared-db.json
  for (const topFile of ['index.html', 'shared-db.json']) {
    const fullPath = path.join(distDir, topFile)
    if (fs.existsSync(fullPath)) {
      const raw = fs.readFileSync(fullPath)
      files[topFile] = zlib.gzipSync(raw, { level: 9 }).toString('base64')
    }
  }

  // 2. assets/*
  const assetsDir = path.join(distDir, 'assets')
  if (fs.existsSync(assetsDir)) {
    for (const name of fs.readdirSync(assetsDir)) {
      const fullPath = path.join(assetsDir, name)
      if (fs.statSync(fullPath).isFile()) {
        const raw = fs.readFileSync(fullPath)
        files[`assets/${name}`] = zlib.gzipSync(raw, { level: 9 }).toString('base64')
      }
    }
  }

  return files
}

async function main() {
  if (!fs.existsSync(distDir)) {
    console.error('[OTA] dist/ directory not found. Run vite build first.')
    process.exit(1)
  }

  exportSharedCompanyDb()

  const buildTime = Date.now()
  const buildIso = new Date(buildTime).toISOString()
  const versionId = `v1.0.${buildTime}`

  const files = collectDistFiles()
  const fileCount = Object.keys(files).length

  const versionMeta = {
    versionId,
    buildTime,
    buildIso,
    fileCount,
    repo: 'berkantcaliskan/portfoy',
  }

  const bundlePayload = {
    ...versionMeta,
    files,
  }

  const versionPath = path.join(distDir, 'ota-version.json')
  const bundlePath = path.join(distDir, 'ota-bundle.json')

  fs.writeFileSync(versionPath, JSON.stringify(versionMeta, null, 2), 'utf-8')
  fs.writeFileSync(bundlePath, JSON.stringify(bundlePayload), 'utf-8')

  const bundleSizeKb = Math.round(fs.statSync(bundlePath).size / 1024)
  console.log(`[OTA] Generated ${versionId} (${fileCount} files, ${bundleSizeKb} KB compressed)`)

  // Sync dist/ and electron/ to local dist-electron & win-unpacked folders
  const appRoots = [
    path.join(rootDir, 'dist-electron', 'resources', 'app'),
    path.join(rootDir, 'dist-electron', 'win-unpacked', 'resources', 'app'),
  ]
  for (const appRoot of appRoots) {
    try {
      if (fs.existsSync(appRoot)) {
        fs.cpSync(distDir, path.join(appRoot, 'dist'), { recursive: true, force: true })
        fs.cpSync(electronDir, path.join(appRoot, 'electron'), { recursive: true, force: true })
        console.log(`[OTA] Synced dist + electron -> ${appRoot}`)
      }
    } catch (e) {
      console.warn(`[OTA] Could not sync ${appRoot}:`, e.message)
    }
  }

  // Commit & push to GitHub (origin main)
  if (process.argv.includes('--push')) {
    try {
      console.log('[OTA] Pushing update & cloud DB to GitHub (berkantcaliskan/portfoy)...')
      execSync('git add -A', { cwd: rootDir, stdio: 'inherit' })
      try {
        execSync(`git commit -m "chore(ota): auto-update release ${versionId} with synced users & db"`, {
          cwd: rootDir,
          stdio: 'inherit',
        })
      } catch {
        // Nothing new to commit
      }
      execSync('git push origin main', { cwd: rootDir, stdio: 'inherit' })
      console.log('[OTA] Successfully pushed to GitHub (origin/main)!')
    } catch (gitErr) {
      console.warn('[OTA] Git push warning:', gitErr.message)
    }
  }
}

main()
