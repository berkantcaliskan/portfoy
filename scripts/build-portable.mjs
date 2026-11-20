import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const cwd = fileURLToPath(new URL('../', import.meta.url))
const node = process.execPath

function run(command, args) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

if (process.platform === 'win32') run('cmd.exe', ['/d', '/c', 'npm.cmd run build'])
else run('npm', ['run', 'build'])
run(node, ['scripts/publish-ota.mjs', '--stamp'])
run(node, ['node_modules/electron-builder/cli.js', '--win', 'portable', '--x64',
  '--config.asar=true',
  '--config.win.signAndEditExecutable=true', '--config.win.signExecutable=false',
  '--config.portable.artifactName=Demirturk-Portfoy-Portable-x64.exe'])
