import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const appDataBase =
  process.env.APPDATA ||
  (process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support')
    : path.join(os.homedir(), '.config'))
const permanentUserDataDir = path.join(appDataBase, 'DemirturkPortfoy')
const persistentDbPath = path.join(permanentUserDataDir, 'demirturk_persistent_db.json')

function loadDiskStore(): Record<string, string> {
  try {
    if (fs.existsSync(persistentDbPath)) {
      const raw = fs.readFileSync(persistentDbPath, 'utf-8')
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        return parsed
      }
    }
  } catch {
    // ignore read error
  }
  return {}
}

function saveDiskStore(store: Record<string, string>) {
  try {
    if (!fs.existsSync(permanentUserDataDir)) {
      fs.mkdirSync(permanentUserDataDir, { recursive: true })
    }
    const tmpPath = persistentDbPath + '.tmp'
    fs.writeFileSync(tmpPath, JSON.stringify(store), 'utf-8')
    fs.renameSync(tmpPath, persistentDbPath)
  } catch (err) {
    console.error('[DiskDB] Failed to save persistent database:', err)
  }
}

function demirturkPersistentDiskPlugin() {
  return {
    name: 'demirturk-persistent-disk-db',
    configureServer(server: any) {
      server.middlewares.use('/__demirturk_disk_db', (req: any, res: any) => {
        if (req.method === 'GET') {
          const store = loadDiskStore()
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store')
          res.end(JSON.stringify(store))
          return
        }

        if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk: any) => {
            body += chunk.toString()
          })
          req.on('end', () => {
            try {
              const payload = JSON.parse(body || '{}')
              const store = loadDiskStore()
              if (payload.action === 'set' && typeof payload.key === 'string') {
                store[payload.key] = String(payload.value ?? '')
                saveDiskStore(store)
              } else if (payload.action === 'remove' && typeof payload.key === 'string') {
                delete store[payload.key]
                saveDiskStore(store)
              } else if (payload.action === 'replaceAll' && payload.store && typeof payload.store === 'object') {
                saveDiskStore(payload.store)
              }
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true }))
            } catch {
              res.statusCode = 400
              res.end(JSON.stringify({ ok: false }))
            }
          })
          return
        }

        res.statusCode = 405
        res.end()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), demirturkPersistentDiskPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 9001,
    strictPort: true,
    host: true,
    watch: {
      ignored: ['**/dist-electron/**', '**/release/**']
    }
  }
})
