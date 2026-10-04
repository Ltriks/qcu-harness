"""Number transcript lines, validate quoted evidence, render a draft action list."""
import argparse
import hashlib
import json
from pathlib import Path


def read_source(path):
    path = Path(path)
    if path.suffix.lower() not in {'.txt', '.md'}:
        raise ValueError('Only UTF-8 TXT/Markdown transcripts are supported.')
    raw = path.read_bytes()
    lines = raw.decode('utf-8-sig').splitlines()
    if not any(line.strip() for line in lines):
        raise ValueError('Transcript is empty.')
    return lines, hashlib.sha256(raw).hexdigest()


def prepare(source, out):
    lines, digest = read_source(source)
    out = Path(out)
    if out.exists():
        raise ValueError('Output directory must not exist.')
    out.mkdir(parents=True, exist_ok=False)
    (out / 'numbered.txt').write_text('\n'.join(f'{i:04d} | {s}' for i, s in enumerate(lines, 1)) + '\n', encoding='utf-8')
    (out / 'source.json').write_text(json.dumps(dict(source=Path(source).name, sha256=digest, lines=len(lines)), indent=2) + '\n', encoding='utf-8')


def validate(lines, data):
    if not isinstance(data, dict) or set(data) != {'items', 'uncertainties'}:
        raise ValueError('Expected only items and uncertainties.')
    if not isinstance(data['items'], list) or not isinstance(data['uncertainties'], list):
        raise ValueError('items and uncertainties must be lists.')
    if any(not isinstance(s, str) or not s.strip() for s in data['uncertainties']):
        raise ValueError('Uncertainties must be nonempty strings.')
    for i, item in enumerate(data['items'], 1):
        if not isinstance(item, dict) or set(item) != {'kind', 'task', 'owner', 'deadline', 'evidence'}:
            raise ValueError(f'Item {i}: invalid fields.')
        if item['kind'] not in ('decision', 'action', 'proposal', 'open_question'):
            raise ValueError(f'Item {i}: unknown kind.')
        if not isinstance(item['task'], str) or not item['task'].strip():
            raise ValueError(f'Item {i}: task is empty.')
        e = item['evidence']
        if not isinstance(e, dict) or set(e) != {'start_line', 'end_line', 'quote'}:
            raise ValueError(f'Item {i}: invalid evidence.')
        start, end = e['start_line'], e['end_line']
        if type(start) is not int or type(end) is not int or not 1 <= start <= end <= len(lines):
            raise ValueError(f'Item {i}: invalid evidence line range.')
        expected = '\n'.join(lines[start - 1:end])
        if not expected.strip() or e['quote'] != expected:
            raise ValueError(f'Item {i}: evidence quote does not match full source lines.')
        for field in ('owner', 'deadline'):
            value = item[field]
            if value is not None and (not isinstance(value, str) or not value.strip() or value not in expected):
                raise ValueError(f'Item {i}: {field} is not a verbatim value in cited evidence.')
    return data


def escape(text):
    return str(text).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('|', '\\|').replace('\n', '<br>')


def render(source, data, out):
    lines, digest = read_source(source)
    validate(lines, data)
    out = Path(out)
    if out.exists():
        raise ValueError('Output directory must not exist.')
    result = dict(status='draft', source=Path(source).name, source_sha256=digest,
                  evidence_check='passed', semantic_review='required', **data)
    text = ['# 会议事项清单（待复核）', '',
            '引用及字段检查通过；语义、遗漏与业务确认仍需复核。', '',
            '| 类型 | 事项 | 负责人 | 时间原话 | 原文位置 |', '| --- | --- | --- | --- | --- |']
    labels = dict(decision='决定', action='行动项', proposal='建议', open_question='待确认')
    for item in data['items']:
        e = item['evidence']
        text.append('| ' + ' | '.join([labels[item['kind']], escape(item['task']),
                    escape(item['owner'] or '未明确'), escape(item['deadline'] or '未明确'),
                    f'L{e["start_line"]}–L{e["end_line"]}']) + ' |')
    if not data['items']:
        text += ['', '没有提取到明确事项。']
    text += ['', '## 原文依据', '']
    for i, item in enumerate(data['items'], 1):
        text += [f'{i}. {escape(item["evidence"]["quote"])}', '']
    text += ['## 不确定事项', '']
    text += ['- ' + escape(s) for s in data['uncertainties']] or ['- 提取结果未列出；仍需复核完整性。']
    out.mkdir(parents=True, exist_ok=False)
    (out / 'actions.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (out / 'report.md').write_text('\n'.join(text) + '\n', encoding='utf-8')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    prep = sub.add_parser('prepare')
    prep.add_argument('source')
    prep.add_argument('--out', required=True)
    output = sub.add_parser('render')
    output.add_argument('source')
    output.add_argument('extracted')
    output.add_argument('--out', required=True)
    args = parser.parse_args()
    try:
        if args.command == 'prepare':
            prepare(args.source, args.out)
        else:
            render(args.source, json.loads(Path(args.extracted).read_text(encoding='utf-8')), args.out)
    except (ValueError, OSError) as exc:
        parser.exit(2, f'Error: {exc}\n')
    print(json.dumps(dict(out=args.out), ensure_ascii=False))


if __name__ == '__main__':
    main()
