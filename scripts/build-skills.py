"""Create reproducible, self-contained QCU skill ZIPs and a draft catalog."""
import argparse
import hashlib
import json
import zipfile
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
VERSION = '0.1.0'
SKILLS = {
    'qcu-table-audit': ('表格体检与清洗', 'CSV/TSV 检查、显式规则清洗和变更记录'),
    'qcu-document-diff': ('文档版本对比', 'TXT/Markdown/DOCX 正文及表格内容差异'),
    'qcu-meeting-actions': ('会议记录转行动清单', 'Agent 提取事项、本地脚本核对原文证据'),
}


def build(out):
    out = Path(out)
    if out.exists():
        raise ValueError('Choose a new output directory; existing files will not be overwritten.')
    prepared = {}
    for name in SKILLS:
        folder = BASE / 'skills' / name
        files = [p for p in sorted(folder.rglob('*')) if p.is_file() and
                 '__pycache__' not in p.parts and p.suffix in {'.md', '.py', '.json', '.txt', '.csv', '.tsv'}]
        if any(p.is_symlink() for p in files):
            raise ValueError('Symlinks are not allowed in skill packages.')
        md = (folder / 'SKILL.md').read_text(encoding='utf-8')
        if f'name: {name}\n' not in md or 'description: ' not in md:
            raise ValueError(f'Invalid skill metadata: {name}')
        prepared[name] = files
    out.mkdir(parents=True, exist_ok=False)
    (out / 'skills').mkdir()
    catalog = {'title': 'QCU 通用办公技能（未发布）', 'version': VERSION,
               'requirements': 'Python >= 3.10; DSH live session compatibility not yet verified.', 'skills': []}
    for name, (title, description) in SKILLS.items():
        filename = f'{name}-{VERSION}.zip'
        target = out / 'skills' / filename
        with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as z:
            for path in prepared[name]:
                info = zipfile.ZipInfo(f'{name}/{path.relative_to(BASE / "skills" / name).as_posix()}',
                                       date_time=(2026, 9, 30, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o100644 << 16
                z.writestr(info, path.read_bytes())
        catalog['skills'].append(dict(id=name, name=title, category='通用', version=VERSION,
            risk='低', summary=description, file=filename, status='draft',
            sha256=hashlib.sha256(target.read_bytes()).hexdigest()))
    (out / 'catalog.draft.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return catalog


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--out', required=True)
    args = p.parse_args()
    try:
        catalog = build(args.out)
    except (ValueError, OSError) as exc:
        p.exit(2, f'Error: {exc}\n')
    print(json.dumps(dict(packages=len(catalog['skills']), out=args.out), ensure_ascii=False))
