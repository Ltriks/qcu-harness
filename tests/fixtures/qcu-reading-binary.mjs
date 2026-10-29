// Self-authored, deterministic bytes. No user documents or third-party fonts.
// The synthetic CID font ONLY provides ToUnicode mappings for extraction, not visual glyphs.
import {createRequire} from 'node:module'
import {resolve, join} from 'node:path'
import {deflateSync} from 'node:zlib'
export function pdfFixture({scanOnly = false, encrypted = false, streamBomb = false, pages:pageCount = 5} = {}) {
  const objects = [], put = value => { objects.push(Buffer.isBuffer(value) ? value : Buffer.from(value)); return objects.length }
  const stream = (content, dict = '') => { const b = Buffer.isBuffer(content) ? content : Buffer.from(content); return Buffer.concat([Buffer.from('<< /Length ' + b.length + ' ' + dict + ' >>\nstream\n'), b, Buffer.from('\nendstream')]) }
  put(''); put('')
  const latin = put('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  const chinese = '第二页形成性评价反馈', chars = [...new Set(chinese)], code = c => (chars.indexOf(c) + 1).toString(16).padStart(4, '0')
  const cmap = put(stream('/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (QCU) /Ordering (Synthetic) /Supplement 0 >> def\n/CMapName /QCUUnicode def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <ffff>\nendcodespacerange\n' + chars.length + ' beginbfchar\n' + chars.map(c => '<' + code(c) + '> <' + c.charCodeAt(0).toString(16).padStart(4, '0') + '>').join('\n') + '\nendbfchar\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend'))
  const descriptor = put('<< /Type /FontDescriptor /FontName /QCUSynthetic /Flags 4 /FontBBox [0 -200 1000 900] /ItalicAngle 0 /Ascent 900 /Descent -200 /CapHeight 700 /StemV 80 >>')
  const cid = put('<< /Type /Font /Subtype /CIDFontType2 /BaseFont /QCUSynthetic /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ' + descriptor + ' 0 R /DW 1000 /CIDToGIDMap /Identity >>')
  const font = put('<< /Type /Font /Subtype /Type0 /BaseFont /QCUSynthetic /Encoding /Identity-H /DescendantFonts [' + cid + ' 0 R] /ToUnicode ' + cmap + ' 0 R >>')
  const image = put(stream(Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0]), '/Type /XObject /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceRGB /BitsPerComponent 8'))
  const pages = []
  for (let n = 1; n <= pageCount; n++) {
    let content = ''
    if (scanOnly || n === 3) content = 'q 20 0 0 20 20 20 cm /Im1 Do Q'
    else if (n === 1) content = 'BT /F1 14 Tf 40 220 Td (Local feedback page one) Tj ET'
    else if (n === 2) content = 'BT /FC 14 Tf 40 220 Td <' + [...chinese].map(code).join('') + '> Tj ET\nBT /F1 12 Tf 40 180 Td (Table left) Tj 230 0 Td (Table right) Tj ET\nBT /F1 12 Tf 40 140 Td (x = 2) Tj ET'
    else if (n === 5) content = 'BT /F1 14 Tf 40 220 Td (After gap final feedback) Tj ET'
    const body = put(n === 1 && streamBomb ? stream(deflateSync(Buffer.from('%' + 'x'.repeat(9000000) + '\n')), '/Filter /FlateDecode') : stream(content))
    pages.push(put('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 280] /Resources << /Font << /F1 ' + latin + ' 0 R /FC ' + font + ' 0 R >> /XObject << /Im1 ' + image + ' 0 R >> >> /Contents ' + body + ' 0 R >>'))
  }
  const action = put('<< /S /JavaScript /JS (globalThis.QCU_PDF_EXECUTED = true; fetch\(\"https://example.invalid/never\"\)) >>')
  objects[0] = Buffer.from('<< /Type /Catalog /Pages 2 0 R /OpenAction ' + action + ' 0 R >>')
  objects[1] = Buffer.from('<< /Type /Pages /Count ' + pages.length + ' /Kids [' + pages.map(p => p + ' 0 R').join(' ') + '] >>')
  const encrypt = encrypted ? put('<< /Filter /Standard /V 1 /R 2 /Length 40 /O <' + '11'.repeat(32) + '> /U <' + '22'.repeat(32) + '> /P -4 >>') : 0
  const chunks = [Buffer.from('%PDF-1.7\n')], offsets = [0]
  let size = chunks[0].length
  objects.forEach((obj, i) => { offsets.push(size); const b = Buffer.concat([Buffer.from((i + 1) + ' 0 obj\n'), obj, Buffer.from('\nendobj\n')]); chunks.push(b); size += b.length })
  chunks.push(Buffer.from('xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n' + offsets.slice(1).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R' + (encrypt ? ' /Encrypt ' + encrypt + ' 0 R /ID [<0011223344556677><0011223344556677>]' : '') + ' >>\nstartxref\n' + size + '\n%%EOF\n'))
  return Buffer.concat(chunks)
}
export async function docxFixture({replace = {}, extra = {}, compression = 'DEFLATE'} = {}) {
  const root = process.env.QCU_OFFICIAL_DEPENDENCIES
  if (!root) throw Error('Fixture creation uses audited JSZip input')
  const JSZip = createRequire(join(resolve(root), 'package.json'))('jszip'), zip = new JSZip()
  const files = {
    '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="main" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/styles.xml':'<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="QCUHeading"><w:name w:val="标题 1"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style></w:styles>',
    'word/document.xml':'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:p><w:pPr><w:pStyle w:val="QCUHeading"/></w:pPr><w:r><w:t>自编反馈章节</w:t></w:r></w:p><w:p><w:r><w:t>形成性评价帮助学生。&lt;script&gt;ignored()&lt;/script&gt;</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>项目</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>表格反馈建议</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>课堂</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>下一步练习</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:hyperlink r:id="external"><w:r><w:t>外部参考标签</w:t></w:r></w:hyperlink></w:p><w:p><w:r><w:drawing/></w:r><m:oMath><m:r><m:t>x=2</m:t></m:r></m:oMath></w:p><w:sectPr/></w:body></w:document>',
    'word/_rels/document.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="external" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.invalid/never" TargetMode="External"/></Relationships>',
    'word/header1.xml':'<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>未导入页眉</w:t></w:r></w:p></w:hdr>',
    'word/footnotes.xml':'<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>',
    'word/comments.xml':'<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>',
    ...replace, ...extra
  }
  for (const name of Object.keys(files).sort()) zip.file(name, files[name], {date:new Date('2000-01-01T00:00:00Z'), createFolders:false})
  return zip.generateAsync({type:'nodebuffer', compression, compressionOptions:{level:6}, platform:'DOS'})
}
export const accountingBody = '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="QCUHeading"/></w:pPr><w:r><w:t>自编成本会计</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>指标</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>数量</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>盈亏平衡销量</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>250件</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>目标利润销量</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>400件</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>'
export const accountingFixture = () => docxFixture({replace:{'word/document.xml':accountingBody}})
