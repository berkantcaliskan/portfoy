import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')
const electronDir = path.join(rootDir, 'electron')

const SUPABASE_URL = 'https://qspefqddkddxobfxxmqa.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzcGVmcWRka2RkeG9iZnh4bXFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NzI4NjksImV4cCI6MjA5MDU0ODg2OX0.f1A3WG3-efXbjb8-D326227-j-0m27441V5yT2I2tPg'

function collectDistFiles() {
  const files = {}

  // 1. index.html
  const indexHtmlPath = path.join(distDir, 'index.html')
  if (fs.existsSync(indexHtmlPath)) {
    const raw = fs.readFileSync(indexHtmlPath)
    files['index.html'] = zlib.gzipSync(raw, { level: 9 }).toString('base64')
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

async function upsertSupabaseKey(key, value) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?on_conflict=key`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        key,
        value,
        updated_at: new Date().toISOString(),
      }),
    })
    return res.ok
  } catch (err) {
    console.warn(`[OTA] Supabase upload warning for ${key}:`, err.message)
    return false
  }
}

function readGitCredentialToken() {
  try {
    const out = execSync('git credential fill', {
      cwd: rootDir,
      input: 'protocol=https\nhost=github.com\n\n',
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    })
    const match = out.match(/password=([^\r\n]+)/)
    return match ? match[1].trim() : ''
  } catch {
    return ''
  }
}

async function main() {
  if (!fs.existsSync(distDir)) {
    console.error('[OTA] dist/ directory not found. Run vite build first.')
    process.exit(1)
  }

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
      console.log('[OTA] Pushing update to GitHub (berkantcaliskan/portfoy)...')
      execSync('git add -A', { cwd: rootDir, stdio: 'inherit' })
      try {
        execSync(`git commit -m "chore(ota): auto-update release ${versionId}"`, {
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
