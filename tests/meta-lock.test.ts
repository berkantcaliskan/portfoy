import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {digest,verifyManifest} from '../scripts/verify-meta-lock.mjs'

function fixture(fn:(root:string,manifest:any)=>void){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'meta-lock-test-'))
 fs.writeFileSync(path.join(root,'protected.ts'),'manualOnly=true\n')
 try{fn(root,{schemaVersion:1,files:[{path:'protected.ts',sha256:digest('manualOnly=true\n')}]})}
 finally{assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert.ok(path.basename(root).startsWith('meta-lock-test-'));fs.rmSync(root,{recursive:true})}
}
test('Meta koruması orijinal dosyayı kabul eder',()=>fixture((root,m)=>assert.equal(verifyManifest(root,m),1)))
test('Onaysız davranış değişikliği korumayı düşürür',()=>fixture((root,m)=>{fs.writeFileSync(path.join(root,'protected.ts'),'manualOnly=false\n');assert.throws(()=>verifyManifest(root,m),/Açık kullanıcı onayı/)}))
test('Silinen dosya korumayı düşürür',()=>fixture((root,m)=>{fs.unlinkSync(path.join(root,'protected.ts'));assert.throws(()=>verifyManifest(root,m),/protected.ts/)}))
test('Windows ve Git satır sonları aynı sürüm sayılır',()=>fixture((root,m)=>{fs.writeFileSync(path.join(root,'protected.ts'),'manualOnly=true\r\n');assert.equal(verifyManifest(root,m),1)}))
test('Manifest proje dışına erişemez',()=>fixture((root,m)=>{m.files[0].path='../other';assert.throws(()=>verifyManifest(root,m),/Güvensiz/)}))
test('Boş manifest doğrulamayı atlayamaz',()=>fixture((root,m)=>{m.files=[];assert.throws(()=>verifyManifest(root,m),/Geçersiz/)}))
test('Aynı yol iki kez manifest içine konamaz',()=>fixture((root,m)=>{m.files.push(m.files[0]);assert.throws(()=>verifyManifest(root,m),/Güvensiz/)}))
test('Korumalı klasöre yeni dosyayla kontrol atlanamaz',()=>fixture((root,m)=>{
 fs.mkdirSync(path.join(root,'meta'));fs.writeFileSync(path.join(root,'meta','new.ts'),'changed')
 m.protectedDirectories=['meta'];assert.throws(()=>verifyManifest(root,m),/onaysız yeni dosya/)
}))
