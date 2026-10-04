"""Content-only TXT/Markdown/DOCX diff with explicit coverage."""
import argparse
import difflib
import hashlib
import json
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def read_document(path):
    path = Path(path)
    raw = path.read_bytes()
    meta = dict(name=path.name, sha256=hashlib.sha256(raw).hexdigest(), excluded_parts=[])
    if path.suffix.lower() in {'.txt', '.md'}:
        blocks = [dict(location=f'line:{i}', text=line)
                  for i, line in enumerate(raw.decode('utf-8-sig').splitlines(), 1)]
        return blocks, meta
    if path.suffix.lower() != '.docx':
        raise ValueError('Supported formats: .txt, .md, .docx')
    with zipfile.ZipFile(path) as archive:
        info = archive.getinfo('word/document.xml')
        if info.file_size > 20_000_000:
            raise ValueError('DOCX document XML exceeds 20 MB limit.')
        xml = archive.read(info)
        if b'<!DOCTYPE' in xml or b'<!ENTITY' in xml:
            raise ValueError('DTD/entities are not supported.')
        root = ET.fromstring(xml)
        forbidden = {'ins', 'del', 'moveFrom', 'moveTo', 'sdt', 'txbxContent', 'altChunk',
                     'fldChar', 'fldSimple', 'instrText', 'sym'}
        for node in root.iter():
            local = node.tag.rsplit('}', 1)[-1]
            if local in forbidden or local.endswith('PrChange') or local in {'oMath', 'oMathPara'}:
                raise ValueError(f'Unsupported DOCX structure: {local}; use reviewed plain text.')
        meta['excluded_parts'] = [n for n in archive.namelist() if n.startswith('word/') and
                                  (any(x in n for x in ('header', 'footer', 'footnotes', 'endnotes', 'comments', 'media/', 'embeddings/')))]
        body = root.find(W + 'body')
        if body is None:
            raise ValueError('Missing DOCX body.')
        blocks = []

        def visit(container, prefix):
            paragraphs = tables = 0
            for child in container:
                if child.tag == W + 'p':
                    paragraphs += 1
                    pieces = []
                    for node in child.iter():
                        if node.tag == W + 't':
                            pieces.append(node.text or '')
                        elif node.tag == W + 'tab':
                            pieces.append('\t')
                        elif node.tag in {W + 'br', W + 'cr'}:
                            pieces.append('\n')
                    blocks.append(dict(location=f'{prefix}/p:{paragraphs}', text=''.join(pieces)))
                elif child.tag == W + 'tbl':
                    tables += 1
                    for ri, row in enumerate(child.findall(W + 'tr'), 1):
                        for ci, cell in enumerate(row.findall(W + 'tc'), 1):
                            visit(cell, f'{prefix}/table:{tables}/row:{ri}/cell:{ci}')
                elif child.tag not in {W + 'sectPr', W + 'tcPr', W + 'bookmarkStart', W + 'bookmarkEnd'}:
                    raise ValueError(f'Unsupported body/cell element: {child.tag}')
        visit(body, 'body')
    return blocks, meta


def compare(old, new, out):
    before, old_meta = read_document(old)
    after, new_meta = read_document(new)
    out = Path(out)
    if out.exists():
        raise ValueError('Output directory must not exist.')
    matcher = difflib.SequenceMatcher(None, [x['text'] for x in before],
                                     [x['text'] for x in after], autojunk=False)
    changes = [dict(kind=tag, before=before[a:b], after=after[c:d])
               for tag, a, b, c, d in matcher.get_opcodes() if tag != 'equal']
    result = dict(old=old_meta, new=new_meta, changes=changes,
                  scope='Body text and table cell paragraphs only; not formatting or whole-file equivalence.',
                  limitations=['No page numbers, styles, numbering, graphics, comments, headers or footnotes.',
                               'Moves may appear as delete plus insert; text line endings are normalized.'])
    lines = ['# 文档内容差异', '', f'变化片段：{len(changes)}。仅比较已支持的文字范围。',
             '', '未检查版式、页码、自动编号、图片、页眉页脚、脚注及批注；移动可能表现为增删。', '']
    for index, change in enumerate(changes, 1):
        lines += [f'## {index}. {change["kind"]}', '']
        for label, key in [('旧版', 'before'), ('新版', 'after')]:
            lines += [f'### {label}', '']
            for block in change[key]:
                lines += [f'位置：{block["location"]}', '']
                # Quote raw text without allowing it to form executable/rendered HTML.
                escaped = block['text'].replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                lines += ['    ' + line for line in escaped.split('\n')] + ['']
    lines += ['## 未纳入的文件部件', '', json.dumps({'old': old_meta['excluded_parts'],
              'new': new_meta['excluded_parts']}, ensure_ascii=False), '']
    out.mkdir(parents=True, exist_ok=False)
    (out / 'diff.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (out / 'report.md').write_text('\n'.join(lines), encoding='utf-8')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('old')
    parser.add_argument('new')
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    try:
        result = compare(args.old, args.new, args.out)
    except (ValueError, OSError, zipfile.BadZipFile, KeyError, ET.ParseError) as exc:
        parser.exit(2, f'Error: {exc}\n')
    print(json.dumps({'changes': len(result['changes']), 'out': args.out}, ensure_ascii=False))


if __name__ == '__main__':
    main()
