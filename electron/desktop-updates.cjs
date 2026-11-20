const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')
const { promisify } = require('node:util')
const { gunzip } = require('node:zlib')

const repo = 'berkantcaliskan/portfoy'
const tag = 'portfoy-desktop'
const releaseUrl = `https://api.github.com/repos/${repo}/releases/tags/${tag}`
const assetPattern = /^renderer-v1-(\d{13})\.bundle\.gz$/
const cachePattern = /^(\d{13})-[a-f0-9]{16}$/
const maxBundleBytes = 32 * 1024 * 1024
const maxExpandedBytes = 96 * 1024 * 1024
const rootFiles = /^(?:index\.html|apple-touch-icon\.png|demirturk-emblem(?:-white)?\.png|favicon(?:-\d+x\d+)?\.(?:ico|png|svg)|icons\.svg)$/
const assetFile = /^(?:assets|backgrounds|fonts)\/[A-Za-z0-9_. -]+\.(?:js|css|png|jpe?g|webp|gif|avif|svg|ico|woff2?|ttf|otf|txt|mp3|wav|mp4|webm|wasm)$/

function isRendererFile(file) {
  return !file.includes('..') && (rootFiles.test(file) || assetFile.test(file))
}

function selectReleaseAsset(release, buildTime) {
  if (release?.tag_name !== tag || release.draft || !Array.isArray(release.assets)) return null
  return release.assets.map(asset => {
    const build = Number(typeof asset?.name === 'string' && asset.name.match(assetPattern)?.[1])
    if (build <= buildTime || !Number.isSafeInteger(build) || asset.state !== 'uploaded'
      || !Number.isSafeInteger(asset.size) || asset.size < 1 || asset.size > maxBundleBytes
      || typeof asset.digest !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(asset.digest)) return null
    return { name: asset.name, buildTime: build, sha256: asset.digest.slice(7), size: asset.size }
  }).reduce((newest, asset) => asset && (!newest || asset.buildTime > newest.buildTime) ? asset : newest, null)
}

async function readBounded(response, limit) {
  if (!response.body || Number(response.headers.get('content-length')) > limit) throw new Error('Güncelleme dosyası boyutu geçersiz.')
  const chunks = []
  let bytes = 0
  for await (const chunk of response.body) {
    bytes += chunk.byteLength
    if (bytes > limit) throw new Error('Güncelleme dosyası çok büyük.')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks, bytes)
}

function checkEntrypoint(files) {
  const index = files.get('index.html')?.toString('utf8')
  if (!index) throw new Error('Uygulama giriş dosyası eksik.')
  const references = [...index.matchAll(/(?:src|href)=["']\.\/(assets\/[^"']+)["']/g)]
  if (!references.some(([, file]) => file.endsWith('.js')) || references.some(([, file]) => !files.has(file))) {
    throw new Error('Uygulama dosyaları eksik.')
  }
}

async function installBundle(cacheDir, asset, bundle) {
  if (bundle.length !== asset.size || crypto.createHash('sha256').update(bundle).digest('hex') !== asset.sha256) {
    throw new Error('Güncelleme bütünlüğü doğrulanamadı.')
  }
  const decoded = await promisify(gunzip)(bundle, { maxOutputLength: maxExpandedBytes })
  const payload = JSON.parse(decoded.toString('utf8'))
  if (payload.version !== 1 || payload.buildTime !== asset.buildTime || !payload.files || Array.isArray(payload.files)) {
    throw new Error('Güncelleme sürümü geçersiz.')
  }
  const files = new Map()
  const lowerNames = new Set()
  for (const [name, content] of Object.entries(payload.files)) {
    if (!isRendererFile(name) || lowerNames.has(name.toLowerCase()) || typeof content !== 'string') {
      throw new Error('Güncelleme dosyası geçersiz.')
    }
    lowerNames.add(name.toLowerCase())
    files.set(name, Buffer.from(content, 'base64'))
  }
  checkEntrypoint(files)
  const root = path.resolve(cacheDir)
  const target = path.join(root, `${asset.buildTime}-${asset.sha256.slice(0, 16)}`)
  await fs.mkdir(root, { recursive: true })
  const pending = await fs.mkdtemp(path.join(root, '.pending-'))
  try {
    for (const [name, data] of files) {
      const destination = path.join(pending, name)
      await fs.mkdir(path.dirname(destination), { recursive: true })
      await fs.writeFile(destination, data)
    }
    await fs.rename(pending, target)
    return path.join(target, 'index.html')
  } finally {
    if (path.dirname(pending) === root && path.basename(pending).startsWith('.pending-')) {
      await fs.rm(pending, { recursive: true, force: true }).catch(() => {})
    }
  }
}

async function readBuildTime(bundledDir) {
  try {
    const { buildTime } = JSON.parse(await fs.readFile(path.join(bundledDir, 'desktop-build.json'), 'utf8'))
    if (Number.isSafeInteger(buildTime) && buildTime > 0) return buildTime
  } catch {}
  return 0
}

async function activeRenderer(bundledDir, cacheDir) {
  let active = { buildTime: await readBuildTime(bundledDir), index: path.join(bundledDir, 'index.html') }
  const entries = await fs.readdir(cacheDir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    const buildTime = Number(entry.name.match(cachePattern)?.[1])
    if (!entry.isDirectory() || !Number.isSafeInteger(buildTime) || buildTime <= active.buildTime) continue
    const index = path.join(cacheDir, entry.name, 'index.html')
    if (await fs.stat(index).then(file => file.isFile(), () => false)) active = { buildTime, index }
  }
  return active
}

async function checkRendererUpdate({ cacheDir, active, onDownload, fetcher = fetch }) {
  const metadata = await fetcher(releaseUrl, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Demirturk-Portfoy' },
    signal: AbortSignal.timeout(3000),
  })
  if (!metadata.ok) throw new Error('Güncelleme kanalına ulaşılamadı.')
  const asset = selectReleaseAsset(JSON.parse((await readBounded(metadata, 1024 * 1024)).toString('utf8')), active.buildTime)
  if (!asset) return active
  onDownload?.()
  const response = await fetcher(`https://github.com/${repo}/releases/download/${tag}/${asset.name}`, {
    signal: AbortSignal.timeout(12000),
  })
  if (!response.ok) throw new Error('Güncelleme indirilemedi.')
  const index = await installBundle(cacheDir, asset, await readBounded(response, asset.size))
  return { buildTime: asset.buildTime, index }
}

module.exports = { repo, tag, maxBundleBytes, maxExpandedBytes, isRendererFile, checkEntrypoint, selectReleaseAsset,
  installBundle, activeRenderer, checkRendererUpdate }
