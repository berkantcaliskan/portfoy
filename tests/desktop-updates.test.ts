import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import updates from '../electron/desktop-updates.cjs'

const buildTime = 1_794_000_000_001
const files = {
  'index.html': '<script type="module" src="./assets/app.js"></script>',
  'assets/app.js': 'console.log("fixture")',
}

function releaseAsset(time = buildTime, content = files) {
  const bundle = gzipSync(JSON.stringify({
    version: 1,
    buildTime: time,
    files: Object.fromEntries(Object.entries(content).map(([key, value]) => [key, Buffer.from(value).toString('base64')])),
  }))
  const sha256 = createHash('sha256').update(bundle).digest('hex')
  return { bundle, name: `renderer-v1-${time}.bundle.gz`, size: bundle.length, digest: 'sha256:' + sha256,
    buildTime: time, sha256, state: 'uploaded' }
}

async function withCache(run: (dir: string) => Promise<void>) {
  const root = path.resolve(tmpdir())
  const dir = await mkdtemp(path.join(root, 'portfoy-update-test-'))
  try { await run(dir) }
  finally {
    if (path.dirname(dir) === root && path.basename(dir).startsWith('portfoy-update-test-')) {
      await rm(dir, { recursive: true, force: true })
    }
  }
}

test('Masaüstü kanalı yalnızca doğrulanabilir ve daha yeni paketleri seçer', () => {
  const previous = releaseAsset()
  const valid = releaseAsset(buildTime + 1)
  const wrongDigest = {...releaseAsset(buildTime + 2), digest: 'sha256:invalid'}
  assert.equal(updates.selectReleaseAsset({tag_name:updates.tag, assets:[previous, valid, wrongDigest]}, buildTime)?.name, valid.name)
  assert.equal(updates.selectReleaseAsset({tag_name:'unrelated', assets:[valid]}, 0), null)
  assert.equal(updates.selectReleaseAsset({tag_name:updates.tag, assets:[previous]}, buildTime), null)
})

test('Başlangıç yeni arayüzün tüm dosyaları kurulana kadar güncelleme sonucunu döndürmez', () => withCache(async cacheDir => {
  const asset = releaseAsset()
  const active = {buildTime:0,index:path.join(cacheDir,'bundled','index.html')}
  const calls: string[] = []
  const next = await updates.checkRendererUpdate({
    cacheDir, active,
    onDownload: () => calls.push('downloading'),
    fetcher: async (url: string) => {
      calls.push(url.includes('api.github.com') ? 'metadata' : 'bundle')
      return url.includes('api.github.com')
        ? Response.json({tag_name:updates.tag,assets:[{name:asset.name,digest:asset.digest,size:asset.size,state:'uploaded'}]})
        : new Response(asset.bundle)
    },
  })
  assert.deepEqual(calls, ['metadata','downloading','bundle'])
  assert.equal(next.buildTime, buildTime)
  assert.equal(await readFile(next.index, 'utf8'), files['index.html'])
  assert.equal(await readFile(path.join(path.dirname(next.index), 'assets', 'app.js'), 'utf8'), files['assets/app.js'])
}))

test('Bozuk, eksik veya kapsam dışı bir paket eskisinin yerine geçmez', () => withCache(async cacheDir => {
  const valid = releaseAsset()
  const first = await updates.installBundle(cacheDir, valid, valid.bundle)
  const missing = releaseAsset(buildTime + 1, {'index.html':files['index.html']} as typeof files)
  const data = releaseAsset(buildTime + 2, {...files,'shared-db.json':'{}'})
  await assert.rejects(updates.installBundle(cacheDir, valid, Buffer.alloc(valid.size)), /bütünlüğü/)
  await assert.rejects(updates.installBundle(cacheDir, missing, missing.bundle), /eksik/)
  await assert.rejects(updates.installBundle(cacheDir, data, data.bundle), /dosyası geçersiz/)
  assert.equal((await updates.activeRenderer(path.join(cacheDir,'bundled'),cacheDir)).index, first)
}))
