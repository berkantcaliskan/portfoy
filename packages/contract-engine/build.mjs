import { build } from 'esbuild'
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

process.chdir(fileURLToPath(new URL('.', import.meta.url)))
const output = 'browser'
await mkdir(output, { recursive: true })
const modules = {
  zip: "export { default } from 'jszip'",
  word: "export { renderAsync } from 'docx-preview'",
  canvas: "export { default } from 'html2canvas'",
  pdf: "export { PDFDocument } from 'pdf-lib'",
  reader: "export { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'"
}
for (const [name, contents] of Object.entries(modules)) {
  await build({ stdin: { contents, resolveDir: process.cwd() }, platform: 'browser', format: 'esm',
    bundle: true, minify: true, target: 'es2022', legalComments: 'eof', outfile: path.join(output, name + '.js') })
}
await copyFile('node_modules/pdfjs-dist/build/pdf.worker.min.mjs', path.join(output, 'worker.js'))
await copyFile('node_modules/jszip/index.d.ts', path.join(output, 'zip.d.ts'))
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'))
const notices = []
for (const [dir, entry] of Object.entries(lock.packages)) {
  if (!dir || entry.dev || entry.optional) continue
  const files = await readdir(dir)
  for (const file of files.filter(f => /^(licen[sc]e|notice)([.-]|$)/i.test(f))) {
    const text = await readFile(path.join(dir, file), 'utf8')
    notices.push(dir + ' ' + entry.version + '\n' + text)
  }
}
await writeFile(path.join(output, 'NOTICES.txt'), notices.join('\n\n'))
const publicAssets = path.resolve('../../public/assets')
await mkdir(publicAssets, {recursive:true})
await copyFile(path.join(output,'NOTICES.txt'),path.join(publicAssets,'contract-engine-NOTICES.txt'))
