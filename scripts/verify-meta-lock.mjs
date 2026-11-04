import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'

export const digest=text=>createHash('sha256').update(text.replace(/\r\n/g,'\n')).digest('hex')
export function verifyManifest(root,manifest){
 if(manifest?.schemaVersion!==1||!Array.isArray(manifest.files)||!manifest.files.length) throw Error('Geçersiz Meta koruma manifesti.')
 const base=path.resolve(root),failures=[],seen=new Set()
 for(const entry of manifest.files){
  const name=entry.path
  if(typeof name!=='string'||name.includes('\\')||path.posix.isAbsolute(name)||name.split('/').some(p=>!p||p==='.'||p==='..')||seen.has(name)||!/^[0-9a-f]{64}$/.test(entry.sha256)) throw Error('Güvensiz veya geçersiz koruma girdisi.')
  seen.add(name)
  const resolved=path.resolve(base,name)
  if(!resolved.startsWith(base+path.sep)) throw Error('Koruma yolu proje dışına çıkıyor.')
  if(!fs.existsSync(resolved)||digest(fs.readFileSync(resolved,'utf8'))!==entry.sha256) failures.push(name)
 }
 for(const dir of manifest.protectedDirectories||[]){
  if(typeof dir!=='string'||dir.includes('\\')||path.posix.isAbsolute(dir)||dir.split('/').some(p=>!p||p==='.'||p==='..')) throw Error('Güvensiz korumalı klasör.')
  const visit=name=>{
   const absolute=path.resolve(base,name)
   if(!absolute.startsWith(base+path.sep)) throw Error('Koruma klasörü proje dışına çıkıyor.')
   if(!fs.existsSync(absolute)){failures.push(name);return}
   for(const entry of fs.readdirSync(absolute,{withFileTypes:true})){
    const child=name+'/'+entry.name
    if(entry.isDirectory()) visit(child)
    else if(!seen.has(child)) failures.push(child+' (onaysız yeni dosya)')
   }
  }
  visit(dir)
 }
 if(failures.length) throw Error('Korumalı Meta dosyaları değişti. Açık kullanıcı onayı olmadan manifesti güncellemeyin:\n'+failures.join('\n'))
 return manifest.files.length
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try {
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'meta-protection.json'),'utf8'))
  console.log(`Meta koruması geçti: ${verifyManifest(root,manifest)} dosya.`)
  if(process.argv[2]==='--baseline-ref'){
   const ref=process.argv[3]
   if(!/^[0-9a-f]{40}$/.test(ref||'')) throw Error('Geçerli 40 haneli taban commit SHA gerekli.')
   const listing=execFileSync('git',['ls-tree','--name-only',ref,'--','meta-protection.json'],{cwd:root,encoding:'utf8'})
   if(listing.trim()){
    const baseline=JSON.parse(execFileSync('git',['show',`${ref}:meta-protection.json`],{cwd:root,encoding:'utf8'}))
    console.log(`Taban sürüm koruması geçti: ${verifyManifest(root,baseline)} dosya.`)
   }else console.log('Taban dalda Meta manifesti yok: ilk koruma kurulumu; yönetici incelemesi gerekli.')
  }
 }catch(error){console.error(error.message);process.exitCode=1}
}
