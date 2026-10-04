"""Conservative CSV/TSV auditing. Python 3.10+, standard library only."""
import argparse
import csv
import hashlib
import io
import json
import re
from collections import Counter
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path


def load_table(path):
    path = Path(path)
    if path.suffix.lower() not in {'.csv', '.tsv'}:
        raise ValueError('Only UTF-8 CSV/TSV is supported.')
    raw = path.read_bytes()
    delimiter = '\t' if path.suffix.lower() == '.tsv' else ','
    rows = list(csv.reader(io.StringIO(raw.decode('utf-8-sig'), newline=''),
                           delimiter=delimiter, strict=True))
    if not rows or not rows[0] or any(not h.strip() for h in rows[0]):
        raise ValueError('A nonempty header with nonblank column names is required.')
    headers = rows[0]
    if len(set(h.strip() for h in headers)) != len(headers):
        raise ValueError('Duplicate column names (including surrounding whitespace).')
    for i, row in enumerate(rows[1:], 2):
        if len(row) != len(headers):
            raise ValueError(f'Record {i}: expected {len(headers)} cells, got {len(row)}.')
    return headers, rows[1:], delimiter, hashlib.sha256(raw).hexdigest()


def validate_rules(rules, headers):
    if not isinstance(rules, dict) or set(rules) - {'columns', 'unique_keys', 'drop_exact_duplicates'}:
        raise ValueError('Unknown rule keys or invalid rules object.')
    cols = rules.get('columns', {})
    if not isinstance(cols, dict) or set(cols) - set(headers):
        raise ValueError('Column rules reference missing columns.')
    for name, spec in cols.items():
        if not isinstance(spec, dict) or set(spec) - {'type', 'required', 'trim', 'date_format', 'normalize_date'}:
            raise ValueError(f'Invalid column rule: {name}')
        kind = spec.get('type', 'string')
        if kind not in {'string', 'integer', 'number', 'date'}:
            raise ValueError(f'Unsupported type: {kind}')
        for flag in ('required', 'trim', 'normalize_date'):
            if flag in spec and type(spec[flag]) is not bool:
                raise ValueError(f'{name}.{flag} must be boolean.')
        if kind == 'date' and (not isinstance(spec.get('date_format'), str) or
                               not spec['date_format']):
            raise ValueError(f'{name}: explicit date_format is required.')
        if spec.get('normalize_date') and kind != 'date':
            raise ValueError('normalize_date requires type=date.')
    keys = rules.get('unique_keys', [])
    if not isinstance(keys, list):
        raise ValueError('unique_keys must be a list of column lists.')
    for key in keys:
        if not isinstance(key, list) or not key or any(not isinstance(k, str) or k not in headers for k in key):
            raise ValueError('Unique key must contain existing columns.')
    if type(rules.get('drop_exact_duplicates', False)) is not bool:
        raise ValueError('drop_exact_duplicates must be boolean.')


def valid_type(value, spec):
    kind = spec.get('type', 'string')
    if kind == 'integer':
        return re.fullmatch(r'[+-]?[0-9]+', value) is not None
    if kind == 'number':
        try:
            return Decimal(value).is_finite()
        except InvalidOperation:
            return False
    if kind == 'date':
        try:
            datetime.strptime(value, spec['date_format'])
        except ValueError:
            return False
    return True


def inspect(headers, rows, rules, row_numbers=None):
    issues = []
    row_numbers = row_numbers if row_numbers is not None else list(range(2, len(rows) + 2))
    exact_seen, key_seen = {}, {}
    for number, row in zip(row_numbers, rows):
        def add(code, column=None, **extra):
            issues.append(dict(row=number, column=column, code=code, **extra))
        signature = tuple(row)
        if signature in exact_seen:
            add('duplicate_row', first_row=exact_seen[signature])
        else:
            exact_seen[signature] = number
        for key in rules.get('unique_keys', []):
            values = tuple(row[headers.index(c)] for c in key)
            if any(not v.strip() for v in values):
                continue
            ident = (tuple(key), values)
            if ident in key_seen:
                add('duplicate_key', '+'.join(key), first_row=key_seen[ident])
            else:
                key_seen[ident] = number
        for name, value in zip(headers, row):
            spec = rules.get('columns', {}).get(name, {})
            if value != value.strip():
                add('surrounding_whitespace', name)
            if not value.strip():
                add('required_missing' if spec.get('required') else 'blank', name)
                continue
            if value.lstrip().startswith(('=', '+', '-', '@')):
                add('formula_like_text', name)
            candidate = value.strip() if spec.get('trim') else value
            if not valid_type(candidate, spec):
                add('invalid_' + spec['type'], name, value=value)
    return issues


def audit(source, out, rules=None, clean=False):
    source, out = Path(source), Path(out)
    headers, rows, delimiter, digest = load_table(source)
    rules = {} if rules is None else rules
    validate_rules(rules, headers)
    if out.exists():
        raise ValueError('Output directory must not exist; choose a new path.')
    issues = inspect(headers, rows, rules)
    result_rows, numbers, changes, seen = [], [], [], set()
    for number, original in enumerate(rows, 2):
        # Only byte-for-byte equivalent logical records may be removed.
        if clean and rules.get('drop_exact_duplicates') and tuple(original) in seen:
            changes.append(dict(row=number, operation='drop_exact_duplicate', before=original, after=None))
            continue
        seen.add(tuple(original))
        row = list(original)
        if clean:
            for i, name in enumerate(headers):
                spec = rules.get('columns', {}).get(name, {})
                value = row[i].strip() if spec.get('trim') else row[i]
                if spec.get('normalize_date') and value:
                    try:
                        value = datetime.strptime(value, spec['date_format']).date().isoformat()
                    except ValueError:
                        pass
                if value != row[i]:
                    changes.append(dict(row=number, column=name, operation='normalize', before=row[i], after=value))
                    row[i] = value
        result_rows.append(row)
        numbers.append(number)
    remaining_rules = json.loads(json.dumps(rules))
    if clean:
        for spec in remaining_rules.get('columns', {}).values():
            if spec.get('normalize_date'):
                spec['date_format'] = '%Y-%m-%d'
    report = dict(source=source.name, source_sha256=digest, rows=len(rows),
                  output_rows=len(result_rows), columns=headers, clean_applied=clean,
                  rules=rules, issues=issues, counts=dict(Counter(i['code'] for i in issues)),
                  changes=changes, remaining_issues=inspect(headers, result_rows, remaining_rules, numbers),
                  limitations=['CSV/TSV only; no business scoring.', 'Record numbers are logical CSV rows.',
                               'Formula-like text is flagged but not evaluated or modified.'])
    out.mkdir(parents=True, exist_ok=False)
    (out / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    lines = ['# 表格体检报告', '', f'原始记录：{len(rows)}；输出记录：{len(result_rows)}。',
             f'清洗模式：{clean}；变更：{len(changes)}。', '', '问题分类：', '']
    lines += [f'- {key}: {count}' for key, count in report['counts'].items()] or ['- 未发现本工具覆盖的问题。']
    lines += ['', '详见 report.json 中的原始记录号、问题和逐项变更。业务正确性未检查。',
              'CSV/TSV 请以文本类型导入标识符列；公式样文本未执行或改写。', '']
    (out / 'report.md').write_text('\n'.join(lines), encoding='utf-8')
    if clean:
        target = out / ('cleaned.tsv' if delimiter == '\t' else 'cleaned.csv')
        with target.open('x', encoding='utf-8-sig', newline='') as stream:
            writer = csv.writer(stream, delimiter=delimiter)
            writer.writerow(headers)
            writer.writerows(result_rows)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input')
    parser.add_argument('--out', required=True)
    parser.add_argument('--rules')
    parser.add_argument('--clean', action='store_true')
    args = parser.parse_args()
    try:
        rules = json.loads(Path(args.rules).read_text(encoding='utf-8')) if args.rules else {}
        result = audit(args.input, args.out, rules, args.clean)
    except (ValueError, OSError, csv.Error) as exc:
        parser.exit(2, f'Error: {exc}\n')
    print(json.dumps({'rows': result['rows'], 'issues': len(result['issues']), 'out': args.out}, ensure_ascii=False))


if __name__ == '__main__':
    main()
