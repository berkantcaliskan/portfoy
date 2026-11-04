import {spawn} from 'node:child_process'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
// Mevcut 9002 oturumunun disk aynasını kullanır; 9001'in profilini açmaz.
const profile=path.resolve(root,'../meta-staging-profile')
const child=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),
  '--host','127.0.0.1','--port','9002','--strictPort',...process.argv.slice(2)],{
  cwd:root,stdio:'inherit',env:{...process.env,APPDATA:profile},
})
child.on('error',()=>{console.error('Geliştirme sunucusu açılamadı. Önce npm ci çalıştırın.');process.exitCode=1})
child.on('exit',code=>{process.exitCode=code??1})
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>{child.kill(signal)})
