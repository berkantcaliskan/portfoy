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

const DELETED_IDS_KEY = 'demirturk_deleted_ids_v1'
const CLEAN_LEADS_V8_KEY = 'demirturk_clean_leads_v8_zero'

const BUSINESS_KEYS = new Set([
  'demirturk_clean_slate_v7_demo_ready',
  CLEAN_LEADS_V8_KEY,
  DELETED_IDS_KEY,
  'demirturk_trash_bin_v1',
  'demirturk_users_v2',
  'demirturk_leads_v2',
  'demirturk_activities_v2',
  'demirturk_shared_projects_v2',
  'demirturk_appointments_v2',
  'demirturk_customer_requests_v2',
  'demirturk_collections_v2',
  'demirturk_payments_v2',
  'demirturk_approvals_v2',
  'demirturk_shared_files_v2',
  'demirturk_mail_accounts_v2',
  'demirturk_mail_messages_v2',
  'demirturk_team_assets_v1',
  'demirturk_team_asset_logs_v1',
  'demirturk_team_leaves_v1',
  'demirturk_meta_api_config',
  'demirturk_meta_capi_logs_v1',
])

function isBusinessKey(k) {
  return (
    BUSINESS_KEYS.has(k) ||
    k.startsWith('demirturk_avatar_') ||
    k.startsWith('demirturk_calendar_')
  )
}

function getArrayItemKey(item, i, key) {
  if (typeof item === 'string') return item
  if (!item || typeof item !== 'object') return String(i)
  if (key === 'demirturk_users_v2' && item.username) return String(item.username).toLowerCase()
  if (key === 'demirturk_leads_v2') {
    const ph = String(item.phone || '').replace(/\D/g, '').slice(-10)
    if (ph && ph.length >= 7) return `phone:${ph}`
  }
  return String(item.id || item.username || i)
}

function parseDeletedSet(rawJson) {
  const permanentDeleted = new Set([
    'lead-web-1793205148675-464',
    'lead-web-1793205113366-350',
    'inq-1793205148675',
    'inq-1793205113366',
  ])
  try {
    const arr = JSON.parse(rawJson || '[]')
    if (Array.isArray(arr)) {
      for (const x of arr) {
        if (typeof x === 'string') permanentDeleted.add(x)
      }
    }
  } catch {}
  return permanentDeleted
}

function isItemDeleted(item, i, key, deletedSet) {
  if (!deletedSet || deletedSet.size === 0 || key === DELETED_IDS_KEY) return false
  if (!item || typeof item !== 'object') return false
  if (item.id && deletedSet.has(String(item.id))) return true
  const k = getArrayItemKey(item, i, key)
  if (k && deletedSet.has(k)) return true
  return false
}


function repairLeadItem(l) {
  if (!l || typeof l !== 'object') return l
  let updatedFullName = l.fullName
  let updatedCreatedAt = l.createdAt
  const answers = Array.isArray(l.metaAnswers)
    ? l.metaAnswers
    : Array.isArray(l.inquiries?.[0]?.metaAnswers)
    ? l.inquiries[0].metaAnswers
    : []
  for (const ans of answers) {
    const q = String(ans?.question || '').toLowerCase().trim()
    const val = String(ans?.answer || '').trim()
    if (!val) continue
    if (
      (q === 'adı' || q === 'adi' || q === 'ad' || q === 'ad soyad' || q === 'isim' || q === 'full_name') &&
      (!updatedFullName || updatedFullName === 'Meta Müşterisi' || updatedFullName === 'Meta Müşteri Adayı')
    ) {
      updatedFullName = val
    } else if (q.includes('oluşturul') || q.includes('olusturul') || q.includes('created') || q === 'tarih') {
      const cleaned = val.replace(/(\d)(am|pm)$/i, '$1 $2')
      const d = new Date(cleaned)
      if (!isNaN(d.getTime())) updatedCreatedAt = d.toISOString()
    }
  }
  return { ...l, fullName: updatedFullName, createdAt: updatedCreatedAt }
}

function mergeJsonArrays(aStr, bStr, key, deletedSet) {
  if (key === DELETED_IDS_KEY) {
    const s1 = parseDeletedSet(aStr)
    const s2 = parseDeletedSet(bStr)
    s2.forEach((v) => s1.add(v))
    return JSON.stringify(Array.from(s1))
  }
  try {
    const aRaw = JSON.parse(aStr || '[]')
    const bRaw = JSON.parse(bStr || '[]')
    if (!Array.isArray(aRaw)) return bStr || '[]'
    if (!Array.isArray(bRaw)) return aStr || '[]'
    const a = aRaw.filter((x, i) => !isItemDeleted(x, i, key, deletedSet))
    const b = bRaw.filter((x, i) => !isItemDeleted(x, i, key, deletedSet))
    const map = new Map()
    a.forEach((x, i) => map.set(getArrayItemKey(x, i, key), x))
    b.forEach((x, i) => {
      const k = getArrayItemKey(x, i, key)
      const ex = map.get(k)
      if (!ex) map.set(k, x)
      else map.set(k, { ...ex, ...x })
    })
    return JSON.stringify(Array.from(map.values()))
  } catch {
    return bStr || aStr || '[]'
  }
}

function exportSharedCompanyDb() {
  const appDataDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
  const dbPath = path.join(appDataDir, 'DemirturkPortfoy', 'demirturk_persistent_db.json')
  const cloudDbPath = path.join(dataDir, 'cloud_db.json')

  let existingCloud = {}
  try {
    if (fs.existsSync(cloudDbPath)) {
      existingCloud = JSON.parse(fs.readFileSync(cloudDbPath, 'utf-8')) || {}
    }
  } catch {}

  let localDb = {}
  try {
    if (fs.existsSync(dbPath)) {
      localDb = JSON.parse(fs.readFileSync(dbPath, 'utf-8')) || {}
    }
  } catch {}

  const mergedDeletedJson = mergeJsonArrays(
    existingCloud[DELETED_IDS_KEY],
    localDb[DELETED_IDS_KEY],
    DELETED_IDS_KEY
  )
  const deletedSet = parseDeletedSet(mergedDeletedJson)

  const sharedDb = {
    demirturk_clean_slate_v7_demo_ready: 'true',
    [CLEAN_LEADS_V8_KEY]: 'true',
    [DELETED_IDS_KEY]: mergedDeletedJson,
  }

  const isCloudV8Clean = existingCloud[CLEAN_LEADS_V8_KEY] === 'true'
  const isLocalV8Clean = localDb[CLEAN_LEADS_V8_KEY] === 'true'

  const allKeys = new Set([...Object.keys(existingCloud), ...Object.keys(localDb)])
  for (const k of allKeys) {
    if (!isBusinessKey(k) || k === DELETED_IDS_KEY || k === CLEAN_LEADS_V8_KEY) continue
    const isLeadKey =
      k === 'demirturk_leads_v2' ||
      k === 'demirturk_activities_v2' ||
      k === 'demirturk_customer_requests_v2' ||
      k === 'demirturk_meta_capi_logs_v1'
    const vCloud = isLeadKey && !isCloudV8Clean ? (k === 'demirturk_activities_v2' ? '{}' : '[]') : existingCloud[k]
    const vLocal = isLeadKey && !isLocalV8Clean ? (k === 'demirturk_activities_v2' ? '{}' : '[]') : localDb[k]
    if (k.endsWith('_v2') || k.endsWith('_v1')) {
      if (
        (typeof vCloud === 'string' && vCloud.trim().startsWith('[')) ||
        (typeof vLocal === 'string' && vLocal.trim().startsWith('['))
      ) {
        sharedDb[k] = mergeJsonArrays(vCloud, vLocal, k, deletedSet)
        continue
      }
    }
    sharedDb[k] = typeof vLocal === 'string' ? vLocal : vCloud
  }

  // 1. Write data/cloud_db.json for live multi-PC GitHub sync
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
  fs.writeFileSync(cloudDbPath, JSON.stringify(sharedDb, null, 2), 'utf-8')

  // 2. Write dist/shared-db.json so bundled/OTA dist also has it
  if (fs.existsSync(distDir)) {
    fs.writeFileSync(path.join(distDir, 'shared-db.json'), JSON.stringify(sharedDb), 'utf-8')
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
}

function collectDistFiles() {
  const files = {}

  // 1. index.html, shared-db.json & icon files
  for (const topFile of [
    'index.html',
    'shared-db.json',
    'favicon.svg',
    'favicon.ico',
    'favicon-32x32.png',
    'favicon-16x16.png',
    'apple-touch-icon.png',
  ]) {
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

  // Pull latest cloud_db.json from origin/main before exporting so we never overwrite another PC's data
  try {
    execSync('git fetch origin main', { cwd: rootDir, stdio: 'ignore' })
    const remoteCloudJson = execSync('git show origin/main:data/cloud_db.json', {
      cwd: rootDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    })
    if (remoteCloudJson) {
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
      fs.writeFileSync(path.join(dataDir, 'cloud_db.json'), remoteCloudJson, 'utf-8')
    }
  } catch {}

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

  // Sync dist/ and electron/ to local dist-electron, win-unpacked, and %APPDATA%\DemirturkPortfoy\ota-dist
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

  try {
    const appDataDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
    const userOtaDistDir = path.join(appDataDir, 'DemirturkPortfoy', 'ota-dist')
    if (fs.existsSync(userOtaDistDir)) {
      fs.cpSync(distDir, userOtaDistDir, { recursive: true, force: true })
      console.log(`[OTA] Synced dist -> ${userOtaDistDir}`)
    }
  } catch (e) {
    console.warn('[OTA] Could not sync userOtaDistDir:', e.message)
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
      try {
        execSync('git pull --rebase -X ours origin main', { cwd: rootDir, stdio: 'inherit' })
      } catch {}
      execSync('git push origin main', { cwd: rootDir, stdio: 'inherit' })
      console.log('[OTA] Successfully pushed to GitHub (origin/main)!')
    } catch (gitErr) {
      console.warn('[OTA] Git push warning:', gitErr.message)
    }
  }
}

main()
