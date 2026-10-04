"""Reconstruct the fixed QCU source layout in a new directory, without installing or launching."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]

def run(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout.strip()

def reconstruct(baseline, out):
    lock = json.loads((ROOT / 'upstream/baseline.json').read_text())
    baseline = Path(baseline).resolve(strict=True)
    if run('git', '-C', str(baseline), 'rev-parse', 'HEAD') != lock['commit']:
        raise ValueError('Baseline HEAD must match the pinned official commit.')
    out = Path(out).absolute()
    if out.exists() or out.is_symlink():
        raise ValueError('Use a new output directory; existing output is never overwritten.')
    out.mkdir(parents=True, exist_ok=False)
    upstream = out / 'upstream'
    run('git', '-c', 'credential.helper=', 'clone', '--no-hardlinks', '--local', '--no-checkout', str(baseline), str(upstream))
    run('git', '-C', str(upstream), 'checkout', '--detach', lock['commit'])
    patch = str(ROOT / 'upstream/qcu-office.patch')
    run('git', '-C', str(upstream), 'apply', '--check', patch)
    run('git', '-C', str(upstream), 'apply', '--whitespace=error-all', patch)
    for source in (ROOT / 'upstream/source').rglob('*'):
        if source.is_file() and source.read_bytes() != (upstream / source.relative_to(ROOT / 'upstream/source')).read_bytes():
            raise ValueError('Reconstructed source does not match the candidate slice.')
    shutil.copytree(ROOT / 'packages/qcu-thesis-workbench', out / 'package',
                    ignore=shutil.ignore_patterns('node_modules', 'lib', '__pycache__', '*.pyc'))
    shutil.copytree(ROOT / 'tests/fixtures', out / 'fixtures')
    return {'status': 'reconstructed-source-only', 'commit': lock['commit'],
            'installed': False, 'launched': False, 'sourceSliceVerified': True}

if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--baseline', required=True)
    p.add_argument('--out', required=True)
    a = p.parse_args()
    print(json.dumps(reconstruct(a.baseline, a.out)))
