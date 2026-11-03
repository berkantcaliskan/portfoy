import fs from 'node:fs'
import path from 'node:path'
const findings=[]
const rules=[/EAA[A-Za-z0-9]{40,}/,/(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}/,/sb_secret_[A-Za-z0-9_-]{20,}/,/String\.fromCharCode\(\.\.\.codes\)/]
function walk(dir) {
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    if(['node_modules','.git','dist','data','dist-electron'].includes(entry.name)) continue
    const p=path.join(dir,entry.name)
    if(entry.isDirectory()) walk(p)
    else if(/\.(?:ts|tsx|js|cjs|mjs|sql|json|md)$/.test(p)) {
      const text=fs.readFileSync(p,'utf8')
      if(rules.some(r=>r.test(text))) findings.push(p)
    }
  }
}
walk('.')
for(const p of ['.env','data/cloud_db.json','dist/shared-db.json']) {
  // Bu dosyalar yerel kullanıcı makinesinde bulunabilir; yalnızca izleniyorsa engellenir.
  try {
    const {execFileSync}=await import('node:child_process')
    if(execFileSync('git',['ls-files','--',p],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim()) findings.push(p)
  } catch { /* Henüz git geçmişi olmayan kaynak kopyasında statik tarama devam eder. */ }
}
if(findings.length) { console.error('Gizli değer veya hassas izlenen dosya riski (değerler gösterilmez):\n'+[...new Set(findings)].join('\n'));process.exitCode=1 }
else console.log('Kaynak sır taraması geçti; Git geçmişi ve canlı ortam ayrıca incelenmelidir.')
