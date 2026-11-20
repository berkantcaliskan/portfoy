import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { gzipSync } from 'node:zlib'
import desktop from '../electron/desktop-updates.cjs'
import { containsCredential } from './renderer-credential-check.mjs'
import { checkServerReady } from './check-server-ready.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const dist = path.join(root, 'dist')
const stampFile = path.join(dist, 'desktop-build.json')

function run(command, args, capture = false) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' })
  if (!capture && result.status !== 0) throw new Error(`${command} işlemi tamamlanamadı.`)
  return result
}

function stamp() {
  const buildTime = Date.now()
  fs.writeFileSync(stampFile, JSON.stringify({ buildTime }))
  return buildTime
}

function loadRenderer() {
  const files = new Map()
  function visit(dir, prefix = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const relative = prefix + entry.name
      if (relative === 'desktop-build.json') continue
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory() && ['assets', 'fonts', 'backgrounds'].includes(relative)) {
        visit(fullPath, relative + '/')
      } else {
        if (!entry.isFile() || !desktop.isRendererFile(relative)) throw new Error(`Güncelleme kapsamı dışında: ${relative}`)
        const bytes = fs.readFileSync(fullPath)
        if (/\.(js|html|css|txt|svg)$/.test(relative)) checkPublicContent(relative, bytes.toString('utf8'))
        files.set(relative, bytes)
      }
    }
  }
  visit(dist)
  desktop.checkEntrypoint(files)
  return files
}

function checkPublicContent(filename, text) {
  if (containsCredential(filename, text)) {
    throw new Error(`Pakette gizli anahtar riski: ${filename}`)
  }
  for (const [, encoded] of text.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]+/g)) {
    try {
      const claims = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
      if (claims.role === 'service_role') throw new Error('service_role')
    } catch (error) {
      if (error.message === 'service_role') throw new Error(`Pakette özel Supabase anahtarı: ${filename}`)
    }
  }
}

const flag = process.argv[2]
if (!flag) {
  if (!process.env.npm_execpath) throw new Error('Güncelleme yayını için npm run ota:publish kullanın.')
  run(process.execPath, [process.env.npm_execpath, 'run', 'build'])
}
if (flag === '--stamp') {
  loadRenderer()
  stamp()
} else {
  const buildTime = flag === '--publish-built'
    ? JSON.parse(fs.readFileSync(stampFile, 'utf8')).buildTime
    : stamp()
  if (!Number.isSafeInteger(buildTime) || !/^\d{13}$/.test(String(buildTime))) throw new Error('Derleme tarihi geçersiz.')
  const files = Object.fromEntries([...loadRenderer()].map(([file, data]) => [file, data.toString('base64')]))
  const json = Buffer.from(JSON.stringify({ version: 1, buildTime, files }))
  const bundle = gzipSync(json)
  if (json.length > desktop.maxExpandedBytes || bundle.length > desktop.maxBundleBytes) throw new Error('Güncelleme paketi çok büyük.')
  const dir = path.join(root, 'dist-electron', 'updates')
  const asset = path.join(dir, `renderer-v1-${buildTime}.bundle.gz`)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(asset, bundle)

  if (flag !== '--prepare') {
    await checkServerReady(root)
    const { repo, tag } = desktop
    const head = run('git', ['rev-parse', 'HEAD'], true)
    if (head.status !== 0) throw new Error('Güncelleme kaynağının Git sürümü bulunamadı.')
    const remote = ['--repo', repo]
    const release = run('gh', ['release', 'view', tag, ...remote], true)
    if (release.status === 0) {
      run('gh', ['release', 'upload', tag, asset, ...remote])
    } else {
      run('gh', ['release', 'create', tag, asset, ...remote, '--target', head.stdout.trim(), '--latest=false',
        '--title', 'Portföy Masaüstü Güncellemeleri', '--notes', 'Kurulumsuz Portföy uygulaması için arayüz güncelleme dosyaları.'])
    }
  }
  console.log(path.basename(asset))
}
