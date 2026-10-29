// Explicit audited inputs only; no installation or download. Normal build uses these checked-in outputs.
import {createRequire} from 'node:module'
import {readFile, writeFile, mkdir} from 'node:fs/promises'
import {resolve, join} from 'node:path'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
const root = fileURLToPath(new URL('./', import.meta.url)), out = join(root, 'vendor')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
export async function verifyVendor() {
  const manifest = JSON.parse(await readFile(join(out, 'MANIFEST.json'), 'utf8'))
  for (const f of manifest.outputs) {
    if (hash(await readFile(join(out, f.file))) !== f.sha256) throw Error('Vendor hash mismatch: ' + f.file)
  }
  return manifest
}
if (process.argv.includes('--stage')) {
  if (!process.env.QCU_OFFICIAL_DEPENDENCIES || !process.env.QCU_DOMMATRIX_INPUT) throw Error('Set explicit QCU_OFFICIAL_DEPENDENCIES and QCU_DOMMATRIX_INPUT')
  const require = createRequire(join(resolve(process.env.QCU_OFFICIAL_DEPENDENCIES), 'package.json')), esbuild = require('esbuild')
  if (esbuild.version !== '0.28.1') throw Error('Expected esbuild 0.28.1')
  await mkdir(out, {recursive:true})
  const inputs = [], outputs = [], licenses = []
  async function input(packageName, version, file, base, source) {
    const bytes = await readFile(join(base, file)); inputs.push({package:packageName, version, file, sha256:hash(bytes), source}); return bytes.toString()
  }
  async function output(file, bytes) {
    await writeFile(join(out, file), bytes); outputs.push({file, bytes:Buffer.byteLength(bytes), sha256:hash(bytes)})
  }
  for (const [name, version, files, source, licenseFile] of [
    ['pdfjs-dist', '6.3.289', ['legacy/build/pdf.mjs', 'legacy/build/pdf.worker.mjs'], 'https://github.com/mozilla/pdfjs-dist', 'LICENSE'],
    ['saxes', '6.0.0', ['saxes.js'], 'https://github.com/lddubeau/saxes', 'LICENSE'],
    ['xmlchars', '2.2.0', ['xml/1.0/ed5.js', 'xml/1.1/ed2.js', 'xmlns/1.0/ed3.js'], 'https://github.com/lddubeau/xmlchars', 'LICENSE'],
    ['@thednp/dommatrix', '3.1.2', ['dist/dommatrix.mjs'], 'https://github.com/thednp/dommatrix', 'LICENSE']
  ]) {
    const base = name === '@thednp/dommatrix' ? resolve(process.env.QCU_DOMMATRIX_INPUT) : join(resolve(process.env.QCU_OFFICIAL_DEPENDENCIES), 'node_modules', name)
    const pkg = JSON.parse(await readFile(join(base, 'package.json'), 'utf8'))
    if (pkg.version !== version) throw Error('Unexpected version: ' + name)
    // saxes npm input omits LICENSE. Preserve the complete v6.0.0 upstream notice separately.
    const license = await input(name, version, name === 'saxes' ? 'saxes-LICENSE.txt' : licenseFile, name === 'saxes' ? join(root, 'vendor-inputs') : base, name === 'saxes' ? 'https://raw.githubusercontent.com/lddubeau/saxes/v6.0.0/LICENSE' : source)
    licenses.push(name + ' ' + version + ' — ' + source + '\n\n' + license)
    for (const file of files) {
      let contents = await input(name, version, file, base, source)
      if (name === 'pdfjs-dist') {
        if (file.endsWith('/pdf.mjs')) {
          const noticeEnd = contents.indexOf('*/') + 2
          if (noticeEnd < 2 || !contents.slice(0, noticeEnd).includes('Copyright 2024 Mozilla')) throw Error('PDF.js notice changed')
          licenses.push('PDF.js original notice (main and worker)\n\n' + contents.slice(0, noticeEnd))
          licenses.push('core-js 3.50.0 (embedded in PDF.js legacy files)\n\n' + await input('core-js', '3.50.0', 'core-js-LICENSE.txt', join(root, 'vendor-inputs'), 'https://raw.githubusercontent.com/zloirock/core-js/v3.50.0/LICENSE'))
          // Remove optional native canvas bootstrap. Real DOMMatrix is installed ONLY in our worker.
          const start = contents.indexOf('  let canvas;\n'), end = contents.indexOf('  if (!globalThis.navigator?.language)', start)
          if (start < 0 || end < start) throw Error('PDF.js bootstrap changed')
          contents = contents.slice(0, start) + contents.slice(end)
          const native = 'const canvas = require("@napi-rs/canvas");\n    return canvas.createCanvas(width, height);'
          if (!contents.includes(native)) throw Error('PDF.js canvas factory changed')
          contents = contents.replace(native, 'throw new Error("QCU text parser does not render canvases");')
        } else {
          // Text-only policy: skip image decoding at the interpreter's size gate and report it.
          // Upstream stopAtErrors can otherwise discard the operator list without a visible signal.
          const imageGate = 'const msg = "Image exceeded maximum allowed size and was removed.";\n      if (!ignoreErrors) {\n        throw new Error(msg);\n      }\n      warn(msg);'
          if (!contents.includes(imageGate)) throw Error('PDF.js image gate changed')
          contents = contents.replace(imageGate, 'warn("Image exceeded maximum allowed size and was removed.");')
          const decode = 'class DecodeStream extends BaseStream {'
          if (!contents.includes(decode) || !contents.includes('  ensureBuffer(requested) {\n    const buffer = this.buffer;')) throw Error('PDF.js decode allocator changed')
          contents = contents.replace(decode, 'let qcuDecodedBudget = 0;\nfunction qcuDecodeCheck(size, allocation = size) { if (!Number.isSafeInteger(size) || size < 0 || size > 8388608 || qcuDecodedBudget + allocation > 67108864) { globalThis.__qcuPDFDecodeLimit = true; throw new Error("QCU PDF decoded stream limit"); } }\n' + decode)
          contents = contents.replace('    this._rawMinBufferLength = maybeMinBufferLength || 0;', '    qcuDecodeCheck(maybeMinBufferLength || 0);\n    this._rawMinBufferLength = maybeMinBufferLength || 0;')
          contents = contents.replace('  ensureBuffer(requested) {\n    const buffer = this.buffer;', '  ensureBuffer(requested) {\n    qcuDecodeCheck(requested);\n    const buffer = this.buffer;')
          contents = contents.replace('    const buffer2 = new Uint8Array(size);', '    qcuDecodeCheck(size); qcuDecodedBudget += size;\n    const buffer2 = new Uint8Array(size);')
          const asyncChunk = '        totalLength += chunk.byteLength;'
          if (!contents.includes(asyncChunk)) throw Error('PDF.js streaming decoder changed')
          contents = contents.replace(asyncChunk, asyncChunk + '\n        qcuDecodeCheck(totalLength);')
          contents = contents.replace('      const data = new Uint8Array(totalLength);', '      qcuDecodeCheck(totalLength, 2 * totalLength); qcuDecodedBudget += 2 * totalLength;\n      const data = new Uint8Array(totalLength);')
        }
        const result = await esbuild.transform(contents, {minify:true, format:'esm', target:'node22', legalComments:'none'})
        await output(file.endsWith('/pdf.mjs') ? 'pdf.mjs' : 'pdf.worker.mjs', result.code)
      } else if (name === '@thednp/dommatrix') await output('dommatrix.mjs', contents)
    }
    if (name === 'saxes') {
      const result = await esbuild.build({entryPoints:[join(base, 'saxes.js')], bundle:true, platform:'node', format:'esm', target:'node22', minify:true, legalComments:'none', write:false})
      await output('xml.mjs', result.outputFiles[0].contents)
    }
  }
  await output('THIRD-PARTY-NOTICES.txt', licenses.join('\n\n' + '='.repeat(72) + '\n\n') + '\n')
  await writeFile(join(out, 'MANIFEST.json'), JSON.stringify({recipe:'node vendor.mjs --stage; esbuild 0.28.1, node22 ESM minify; PDF.js native canvas bootstrap removed, canvas rendering throws; image size gate always warns and skips decoding (text-only maxImageSize=0); DecodeStream allocator capped at 8 MiB per buffer and 64 MiB cumulative allocations; limit flag checked by parser; no other semantic patches', inputs, outputs}, null, 2) + '\n')
  const verified = await verifyVendor()
  console.log(JSON.stringify({inputs:verified.inputs.length, outputs:verified.outputs.length, bytes:verified.outputs.reduce((n, f) => n + f.bytes, 0)}))
}
