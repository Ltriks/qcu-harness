"""Local, conservative OOXML format checking; no model or network calls."""
import hashlib
import html
import io
import json
import math
import re
import zipfile
from collections import Counter
from datetime import datetime, timezone
from xml.etree import ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
VERSION = '0.1.0'
MAX_UPLOAD = 20 * 1024 * 1024
PAGE_KEYS = {'width_mm', 'height_mm', 'top_mm', 'bottom_mm', 'left_mm', 'right_mm'}
STYLE_KEYS = {'font_east_asia', 'font_latin', 'size_pt', 'line_multiple', 'first_line_mm'}
LABELS = dict(width_mm='纸张宽度', height_mm='纸张高度', top_mm='上页边距', bottom_mm='下页边距',
              left_mm='左页边距', right_mm='右页边距', font_east_asia='中文字体', font_latin='西文字体',
              size_pt='字号（磅）', line_multiple='行距（倍）', first_line_mm='首行缩进（毫米）')


class InputError(ValueError):
    pass


def xml_read(archive, name, required=False):
    try:
        info = archive.getinfo(name)
    except KeyError:
        if required:
            raise InputError('文档缺少必要的 OOXML 部件。')
        return None
    if info.file_size > 25 * 1024 * 1024:
        raise InputError('文档 XML 过大，首版无法处理。')
    data = archive.read(name)
    if b'<!DOCTYPE' in data or b'<!ENTITY' in data:
        raise InputError('不支持包含 DTD 或实体的 XML。')
    try:
        return ET.fromstring(data)
    except ET.ParseError:
        raise InputError('文档 XML 损坏。') from None


def validate_rule(rule):
    if not isinstance(rule, dict) or set(rule) != {'id', 'name', 'version', 'source', 'page', 'styles'}:
        raise InputError('规则字段不完整或包含未知字段。')
    for key in ('id', 'name', 'version'):
        if not isinstance(rule[key], str) or not 1 <= len(rule[key]) <= 100:
            raise InputError('规则名称、编号或版本不合法。')
    if rule['source'] not in ('demo', 'personal', 'center'):
        raise InputError('未知规则来源。')
    if not isinstance(rule['page'], dict) or set(rule['page']) - PAGE_KEYS:
        raise InputError('页面规则不合法。')
    if not isinstance(rule['styles'], dict) or len(rule['styles']) > 100:
        raise InputError('样式规则不合法。')
    for field, value in rule['page'].items():
        if type(value) not in (int, float) or not math.isfinite(value) or not 0 <= value <= 1000:
            raise InputError('页面数值必须为 0～1000 毫米。')
    for style, spec in rule['styles'].items():
        if not isinstance(style, str) or not style or not isinstance(spec, dict) or set(spec) - STYLE_KEYS:
            raise InputError('样式字段不合法。')
        for field, value in spec.items():
            if field.startswith('font_'):
                if not isinstance(value, str) or not value.strip() or len(value) > 100:
                    raise InputError('字体名称不合法。')
            elif type(value) not in (int, float) or not math.isfinite(value) or not -100 <= value <= 1000:
                raise InputError('样式数值不合法。')
            elif field in ('size_pt', 'line_multiple') and value <= 0:
                raise InputError('字号及行距必须大于零。')
    if not rule['page'] and not any(rule['styles'].values()):
        raise InputError('至少配置一项检查规则。')
    return rule


class Document:
    def __init__(self, data):
        if len(data) > MAX_UPLOAD:
            raise InputError('首版限制单篇文件不超过 20 MB。')
        self.digest = hashlib.sha256(data).hexdigest()
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                if sum(i.file_size for i in z.infolist()) > 80 * 1024 * 1024 or len(z.infolist()) > 2000:
                    raise InputError('解压体积或部件数量超过首版限制。')
                self.root = xml_read(z, 'word/document.xml', True)
                self.style_root = xml_read(z, 'word/styles.xml')
                self.excluded = [n for n in z.namelist() if n.startswith('word/') and any(
                    key in n for key in ('header', 'footer', 'footnotes', 'endnotes', 'comments', 'media/', 'embeddings/'))]
        except (zipfile.BadZipFile, RuntimeError, OSError):
            raise InputError('不是可读取的 DOCX 文件；不支持加密文档。') from None
        forbidden = {'ins', 'del', 'moveFrom', 'moveTo', 'sdt', 'altChunk', 'txbxContent'}
        if any(n.tag.rsplit('}', 1)[-1] in forbidden or n.tag.rsplit('}', 1)[-1].endswith('PrChange')
               for n in self.root.iter()):
            raise InputError('首版不支持修订、内容控件或文本框；请提供确认后的副本。')
        self.body = self.root.find(W + 'body')
        if self.body is None:
            raise InputError('未找到正文。')
        self.styles = {} if self.style_root is None else {
            n.get(W + 'styleId'): n for n in self.style_root.findall(W + 'style')}
        self.default_style = next((k for k, n in self.styles.items()
            if n.get(W + 'type') == 'paragraph' and n.get(W + 'default') == '1'), None)
        self.paragraphs = []
        self.sections = []
        self._walk(self.body, '正文', False)
        if len(self.paragraphs) > 20000:
            raise InputError('段落数量超过首版限制。')
        self.warnings = ['未检查页眉页脚、脚注、批注、图片、自动编号、分页、目录、引用、公式或学术内容。',
            '未实现的主题字体、字符缩进和复杂文字渲染标记为无法判断；不猜测 Word 默认显示效果。',
            '表格条件样式、复杂脚本及布局未解析；表格内段落只做概览，不作格式通过判断。']

    def _walk(self, parent, prefix, in_table):
        p_index = t_index = 0
        for node in parent:
            if node.tag == W + 'p':
                p_index += 1
                location = f'{prefix}/段落{p_index}'
                text = ''.join(n.text or '' for n in node.iter(W + 't'))
                if text.strip():
                    pstyle = node.find('./' + W + 'pPr/' + W + 'pStyle')
                    style = pstyle.get(W + 'val') if pstyle is not None else self.default_style
                    self.paragraphs.append(dict(node=node, location=location, text=text, style=style, in_table=in_table))
                sec = node.find('./' + W + 'pPr/' + W + 'sectPr')
                if sec is not None:
                    self.sections.append(sec)
            elif node.tag == W + 'tbl':
                t_index += 1
                for ri, row in enumerate(node.findall(W + 'tr'), 1):
                    for ci, cell in enumerate(row.findall(W + 'tc'), 1):
                        self._walk(cell, f'{prefix}/表格{t_index}/行{ri}/格{ci}', True)
            elif node.tag == W + 'sectPr':
                self.sections.append(node)
            elif node.tag not in {W + 'tcPr', W + 'bookmarkStart', W + 'bookmarkEnd'}:
                raise InputError('文档包含首版未支持的正文结构。')

    def chain(self, style):
        nodes, seen = [], set()
        while style:
            if style in seen or style not in self.styles:
                return None
            seen.add(style)
            node = self.styles[style]
            nodes.append(node)
            base = node.find(W + 'basedOn')
            style = base.get(W + 'val') if base is not None else None
        return nodes

    def sources(self, paragraph, run=None):
        kind = 'rPr' if run is not None else 'pPr'
        sources = []
        if run is not None:
            direct = run.find(W + 'rPr')
            sources.append(direct)
            char_style = None if direct is None else direct.find(W + 'rStyle')
            if char_style is not None:
                chain = self.chain(char_style.get(W + 'val'))
                if chain is None:
                    return None
                sources += [n.find(W + kind) for n in chain]
        else:
            sources.append(paragraph['node'].find(W + 'pPr'))
        chain = self.chain(paragraph['style'])
        if chain is None:
            return None
        sources += [n.find(W + kind) for n in chain]
        if self.style_root is not None:
            sources.append(self.style_root.find('./' + W + 'docDefaults/' + W + kind + 'Default/' + W + kind))
        return [s for s in sources if s is not None]

    def prop(self, paragraph, field, run=None):
        sources = self.sources(paragraph, run)
        if sources is None:
            return None
        def attr(element, name):
            for source in sources:
                node = source.find(W + element)
                if node is not None and node.get(W + name) is not None:
                    return node.get(W + name)
            return None
        try:
            if field.startswith('font_'):
                font = 'eastAsia' if field == 'font_east_asia' else 'ascii'
                theme = 'eastAsiaTheme' if font == 'eastAsia' else 'asciiTheme'
                for source in sources:
                    node = source.find(W + 'rFonts')
                    if node is not None:
                        if node.get(W + theme) is not None:
                            return None
                        if node.get(W + font) is not None:
                            return node.get(W + font)
                return None
            if field == 'size_pt':
                value = attr('sz', 'val')
                return float(value) / 2 if value is not None else None
            if field == 'line_multiple':
                line, mode = attr('spacing', 'line'), attr('spacing', 'lineRule')
                if mode not in (None, 'auto'):
                    return None
                return float(line) / 240 if line is not None else None
            if field == 'first_line_mm':
                # Character-based indents override twips and depend on font metrics.
                if attr('ind', 'firstLineChars') is not None or attr('ind', 'hangingChars') is not None:
                    return None
                hanging = first = None
                for source in sources:
                    indent = source.find(W + 'ind')
                    if indent is not None and any(indent.get(W + k) is not None for k in ('hanging', 'firstLine')):
                        hanging, first = indent.get(W + 'hanging'), indent.get(W + 'firstLine')
                        break
                if hanging is not None:
                    return -float(hanging) * 25.4 / 1440
                return float(first) * 25.4 / 1440 if first is not None else None
        except (ValueError, OverflowError):
            return None
        return None

    def overview(self):
        counts = Counter(p['style'] or '(未定义)' for p in self.paragraphs)
        styles = []
        for sid, count in counts.items():
            node = self.styles.get(sid)
            name = node.find(W + 'name') if node is not None else None
            styles.append(dict(id=sid, name=name.get(W + 'val') if name is not None else sid, paragraphs=count))
        return dict(paragraphs=len(self.paragraphs), sections=len(self.sections), styles=styles,
                    excluded_parts=self.excluded, warnings=self.warnings)


def check(data, rule):
    validate_rule(rule)
    doc = Document(data)
    findings = []
    counts = Counter(passed=0, failed=0, unknown=0)
    distribution = {key: Counter() for key in STYLE_KEYS}

    def add(location, field, expected, actual, excerpt='', reason=None):
        if actual is None or (isinstance(actual, (float, int)) and not math.isfinite(actual)):
            status = 'unknown'
        elif isinstance(expected, (float, int)):
            status = 'passed' if abs(actual - expected) <= (0.15 if field.endswith('_mm') else 0.02) else 'failed'
        else:
            status = 'passed' if actual == expected else 'failed'
        counts[status] += 1
        if status != 'passed':
            findings.append(dict(status=status, location=location, field=field, label=LABELS.get(field, field),
                expected=expected, actual=actual, excerpt=excerpt[:180], reason=reason or
                ('无法确定有效值，请在 Word 中复核。' if status == 'unknown' else '请核对规则后在论文副本中调整。')))

    for index, section in enumerate(doc.sections, 1):
        size, margin = section.find(W + 'pgSz'), section.find(W + 'pgMar')
        for field, expected in rule['page'].items():
            node = size if field in ('width_mm', 'height_mm') else margin
            key = {'width_mm': 'w', 'height_mm': 'h'}.get(field, field.removesuffix('_mm'))
            try:
                actual = float(node.get(W + key)) * 25.4 / 1440 if node is not None and node.get(W + key) is not None else None
            except ValueError:
                actual = None
            add(f'节{index}', field, expected, actual)
    if not doc.sections:
        for field, expected in rule['page'].items():
            add('页面', field, expected, None)

    for p in doc.paragraphs:
        spec = rule['styles'].get(p['style'])
        if not spec or p['in_table']:
            add(p['location'], '段落规则覆盖', '可识别且已配置的段落样式', None, p['text'],
                '表格条件样式尚未支持。' if p['in_table'] else '此段样式没有配置检查规则。')
        for field in ('line_multiple', 'first_line_mm'):
            actual = doc.prop(p, field)
            distribution[field][str(round(actual, 3)) if isinstance(actual, (int, float)) else '未知'] += 1
            if spec and not p['in_table'] and field in spec:
                add(p['location'], field, spec[field], actual, p['text'])
        for ri, run in enumerate(p['node'].iter(W + 'r'), 1):
            text = ''.join(n.text or '' for n in run.iter(W + 't'))
            if not text.strip():
                continue
            complex_text = bool(re.search(r'[\u0590-\u08ff]', text)) or run.find('./' + W + 'rPr/' + W + 'cs') is not None
            for field in ('size_pt', 'font_east_asia', 'font_latin'):
                relevant = field == 'size_pt' or (field == 'font_east_asia' and re.search(r'[\u3000-\u9fff\uff00-\uffef]', text)) or (field == 'font_latin' and re.search(r'[A-Za-z0-9]', text))
                if not relevant:
                    continue
                actual = None if complex_text else doc.prop(p, field, run)
                distribution[field][str(actual) if actual is not None else '未知'] += 1
                if spec and not p['in_table'] and field in spec:
                    add(f'{p["location"]}/文本片段{ri}', field, spec[field], actual, text)
    return dict(engine_version=VERSION, checked_at=datetime.now(timezone.utc).isoformat(),
        document_sha256=doc.digest, rule=rule, rule_sha256=hashlib.sha256(json.dumps(rule, sort_keys=True, ensure_ascii=False).encode()).hexdigest(),
        counts=dict(counts), findings=findings, overview=doc.overview(),
        format_distribution={k: dict(v) for k, v in distribution.items()},
        conclusion='仅按所选规则检查，不构成 QCU 正式规范合规结论。' if rule['source'] != 'center'
            else '仅覆盖报告列出的检查项，未知项需人工复核。')


def report_html(result):
    esc = lambda value: html.escape(str(value) if value is not None else '无法判断')
    rows = ''.join('<tr>' + ''.join(f'<td>{esc(v)}</td>' for v in
        [dict(failed='不符合所选规则', unknown='需人工确认')[f['status']], f['location'], f['label'],
         f['actual'], f['expected'], f['excerpt'], f['reason']]) + '</tr>' for f in result['findings'])
    count = result['counts']
    warnings = ''.join('<li>' + esc(x) + '</li>' for x in result['overview']['warnings'])
    distributions = ''.join(f'<h3>{esc(LABELS[key])}</h3><p>{esc(json.dumps(values, ensure_ascii=False))}</p>'
                            for key, values in result['format_distribution'].items())
    return f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>QCU 论文格式检查报告</title><style>body{{font:16px/1.6 system-ui,sans-serif;color:#172b3a;max-width:1200px;margin:40px auto;padding:0 24px}}h1{{font-size:28px}}table{{width:100%;border-collapse:collapse}}td,th{{text-align:left;vertical-align:top;padding:10px;border:1px solid #d7e0e7;overflow-wrap:anywhere}}th{{background:#edf3f6}}.notice{{padding:16px;background:#fff5d9}}small{{overflow-wrap:anywhere}}@media print{{body{{margin:0;font-size:11px}}thead{{display:table-header-group}}tr{{break-inside:avoid}}}}</style>
<h1>QCU 论文格式检查报告</h1><p class="notice">{esc(result['conclusion'])}</p>
<p>规则：{esc(result['rule']['name'])} · 来源：{esc(result['rule']['source'])} · 版本：{esc(result['rule']['version'])}</p>
<p>通过 {count['passed']} 项 · 不符合 {count['failed']} 项 · 需确认 {count['unknown']} 项（按属性检查计数，不等于段落数）</p>
<p>所有原文仅在本机报告中展示，未自动修改论文。</p><h2>问题与待确认项</h2>
<table><thead><tr><th>状态</th><th>位置</th><th>检查项</th><th>当前值</th><th>规则要求</th><th>原文片段</th><th>建议／原因</th></tr></thead><tbody>{rows}</tbody></table>
<h2>格式概览</h2><p>非空段落 {result['overview']['paragraphs']}；节 {result['overview']['sections']}。</p>{distributions}
<h2>未检查范围</h2><ul>{warnings}</ul><h2>使用的规则快照</h2><pre>{esc(json.dumps(result["rule"], ensure_ascii=False, indent=2))}</pre><h2>追溯信息</h2><small>引擎 {esc(result['engine_version'])}<br>检查时间 {esc(result['checked_at'])}<br>文档 SHA-256 {esc(result['document_sha256'])}<br>规则 SHA-256 {esc(result['rule_sha256'])}</small></html>'''
