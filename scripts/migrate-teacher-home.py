#!/usr/bin/env python3
"""Maintainer-only rc3 -> rc4 preview and digest-confirmed, exclusive local copy.

Never auto-invoked by the launcher. Diagnostics contain no setting or file values.
"""
import argparse
import ctypes
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import tempfile

TRANSIENT = ['cache', 'code cache', 'gpucache', 'shadercache', 'grshadercache',
             'dawngraphitecache', 'dawnwebgpucache', 'crashpad', 'crash reports',
             'service worker/cachestorage', 'service worker/scriptcache',
             'singletonlock', 'singletoncookie', 'singletonsocket', 'lockfile', 'lock']
METADATA_LIMIT = 1024 * 1024


def metadata(file, limit=METADATA_LIMIT):
    with safe_read(file) as stream:
        if os.fstat(stream.fileno()).st_size > limit:
            raise ValueError('Oversize metadata refused')
        data = stream.read(limit + 1)
        if len(data) > limit:
            raise ValueError('Oversize metadata refused')
        return data.decode('utf-8')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def digest(file):
    h = hashlib.sha256()
    with safe_read(file) as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def safe_read(file):
    # Walk descriptor-relative parents so a concurrent symlink swap cannot escape.
    file = file.absolute()
    parent = os.open(file.anchor, os.O_RDONLY | os.O_DIRECTORY)
    try:
        for part in file.parts[1:-1]:
            child = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent)
            os.close(parent)
            parent = child
        fd = os.open(file.name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent)
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
            os.close(fd)
            raise ValueError('Unsafe file refused')
        return os.fdopen(fd, 'rb')
    finally:
        os.close(parent)


def copy_opaque(source, stage):
    rows = snapshot(source)
    for row in rows:
        dest = stage / row['path']
        if row['kind'] == 'directory':
            dest.mkdir()
        else:
            with safe_read(source / row['path']) as src, dest.open('xb') as out:
                shutil.copyfileobj(src, out)
            if digest(dest) != row['sha256']:
                raise ValueError('Source changed during opaque copy')
            dest.chmod(row['mode'])
            os.utime(dest, ns=(row['mtime'], row['mtime']))
    for row in reversed(rows):
        if row['kind'] == 'directory':
            dest = stage / row['path']
            dest.chmod(row['mode'])
            os.utime(dest, ns=(row['mtime'], row['mtime']))


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()


def no_links(p):
    if not p.is_absolute() or '..' in p.parts or p == Path(p.anchor) or p == Path.home():
        raise ValueError('Separate absolute paths required')
    for part in [p, *p.parents]:
        if part.is_symlink():
            raise ValueError('Symlink path refused')


def included(rel):
    value = rel.lower()
    return not any(value == prefix + name or value.startswith(prefix + name + '/')
                   for prefix in ['electron/', 'electron/default/'] for name in TRANSIENT)


def snapshot(root):
    rows = []

    def visit(folder):
        for p in sorted(folder.iterdir()):
            rel = p.relative_to(root).as_posix()
            if not included(rel):
                continue
            s = p.lstat()
            row = {'path': rel, 'mode': stat.S_IMODE(s.st_mode), 'mtime': s.st_mtime_ns}
            if stat.S_ISDIR(s.st_mode):
                row['kind'] = 'directory'
                rows.append(row)
                visit(p)
            elif stat.S_ISREG(s.st_mode) and s.st_nlink == 1:
                row.update(kind='file', bytes=s.st_size, sha256=digest(p))
                rows.append(row)
            else:
                raise ValueError('Unsafe source entry refused')
    visit(root)
    return rows


def assert_stopped(source):
    if sys.platform != 'darwin':
        raise ValueError('Only the Mac stopped-instance probe is supported')
    # Source-scoped open-file probe, PID output only. No unrelated process argv.
    # This detects open source files, not every Host on the machine; the maintainer
    # must still explicitly stop the selected source before preview/apply.
    result = subprocess.run(['/usr/sbin/lsof', '-t', '+D', str(source)], capture_output=True, timeout=15)
    if result.stdout.strip():
        raise ValueError('Source has open files')
    if result.returncode not in [0, 1] or result.stderr.strip():
        raise ValueError('Cannot verify stopped source')


def yaml_value(kit, data):
    try:
        return json.loads(data)
    except ValueError:
        executable = validation_runtime(kit)
        resources = kit / 'program/DeepSeek Harness.app/Contents/Resources'
        code = "const r=require('node:module').createRequire(process.argv[1]);const fs=require('node:fs');process.stdout.write(JSON.stringify(r('js-yaml').load(fs.readFileSync(0,'utf8'))))"
        env = {'PATH': os.environ.get('PATH', '/usr/bin:/bin'), 'HOME': os.environ['HOME'], 'ELECTRON_RUN_AS_NODE': '1'}
        result = subprocess.run([str(executable), '--expose-internals', '-e', code, str(resources / 'app.asar/dsh/package.json')], input=data.encode(), capture_output=True, env=env, timeout=20)
        if result.returncode:
            raise ValueError('Unsupported source YAML')
        return json.loads(result.stdout)


def validation_runtime(kit):
    override = os.environ.get('QCU_TEACHER_VALIDATION_RUNTIME')
    if not override:
        return kit / 'program/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness'
    config = json.loads((kit / 'support/integrated-inputs.json').read_text())
    pin = config['trustedRuntime']
    runtime = Path(override).absolute()
    no_links(runtime)
    if str(runtime) != pin['path'] or runtime.stat().st_size != pin['bytes'] or digest(runtime) != pin['sha256']:
        raise ValueError('Only the exact trusted reference interpreter is admitted')
    return runtime


def baseline(kit):
    no_links(kit)
    m = json.loads(metadata(kit / 'support/manifest.json'))
    file = kit / 'support/migration-baseline.json'
    data = metadata(file)
    if m['version'] != '0.1.0-rc.4' or sha(data.encode()) != m['migrationBaselineSha256']:
        raise ValueError('Untrusted migration kit')
    old = json.loads(data)
    if old['version'] != '0.1.0-rc.3' or old['seedId'] != '970260c6565d2adc5c886c95a5713aeb2b8b1dac334298d5ba1993809f721789':
        raise ValueError('Unsupported rc3 baseline')
    return m, old


def source_profile(kit, source, old):
    # Recognition must precede any source directory inventory or opaque opens.
    receipt = json.loads(metadata(source / 'qcu-teacher.json', 64 * 1024))
    expected = [{k: p[k] for k in ['id', 'version']} for p in old['products']]
    if receipt.get('version') != old['version'] or receipt.get('seedId') != old['seedId'] or receipt.get('products') != expected:
        raise ValueError('Unsupported source receipt/product baseline')
    profile = source / 'profiles/desktop'
    no_links(profile / 'node_modules')
    no_links(source / 'bin')
    if sorted(p.name for p in (source / 'profiles').iterdir()) != ['desktop']:
        raise ValueError('Unsupported additional profile')
    pkg = json.loads(metadata(profile / 'package.json'))
    ids = [p['id'] for p in old['products']] + ['qcu-branding']
    versions = {p['id']: p['version'] for p in old['products']} | {'qcu-branding': old['branding']['version']}
    if pkg.get('dependencies') != versions or any(pkg.get(k) for k in ['devDependencies', 'optionalDependencies', 'scripts']):
        raise ValueError('Unknown dependencies or user additions require review')
    if sorted(p.name for p in (profile / 'node_modules').iterdir()) != sorted(ids):
        raise ValueError('Unknown installed additions require review')
    bundles = pkg.get('dsh', {}).get('profile', {}).get('bundles')
    if not isinstance(bundles, list) or len(set(bundles)) != len(bundles) or any(p not in ids + ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'] for p in bundles):
        raise ValueError('Unsupported bundle selection')
    if not all(id in bundles for id in ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app']):
        raise ValueError('Missing native base bundles')
    if yaml_value(kit, metadata(profile / 'cordis.yml')) != []:
        raise ValueError('Unsupported base configuration additions')
    patches = yaml_value(kit, metadata(profile / 'cordis.patch.yml'))
    if not isinstance(patches, list) or any(not isinstance(r, dict) or 'insert' in r or 'name' in r for r in patches):
        raise ValueError('Unsupported component additions')
    for id in ids:
        rows = [r for r in patches if r.get('id') == id]
        # Historical branding has no explicit row until a teacher changes it.
        if (id != 'qcu-branding' and len(rows) != 1) or len(rows) > 1 or any('disabled' in r and not isinstance(r['disabled'], bool) for r in rows):
            raise ValueError('Ambiguous previous component selection')
    frozen_files = {r['path'].removeprefix('seed/'): r for r in old['seedFiles'] if '/node_modules/' in r['path'] or r['path'].startswith('seed/bin/')}
    actual = {prefix + '/' + r['path']: r for prefix in ['profiles/desktop/node_modules', 'bin'] for r in snapshot(source / prefix) if r['kind'] == 'file'}
    if set(actual) != set(frozen_files) or any(actual[p]['bytes'] != r['bytes'] or actual[p]['sha256'] != r['sha256'] for p, r in frozen_files.items()):
        raise ValueError('Source managed bytes differ from exact rc3 baseline')
    return pkg, patches


def absolute_workspaces(value):
    if isinstance(value, dict):
        return sum((1 if isinstance(v, str) and os.path.isabs(v) and ('path' in k.lower() or 'workspace' in k.lower()) and k != 'cliPath' else absolute_workspaces(v)) for k, v in value.items())
    if isinstance(value, list):
        return sum(absolute_workspaces(v) for v in value)
    return 0


def preview(kit, source, target):
    kit, source, target = map(lambda p: Path(p).absolute(), [kit, source, target])
    for p in [kit, source, target]:
        no_links(p)
    # samefile catches case/Unicode aliases on the default Mac filesystem as well.
    def inside(candidate, root):
        return root.exists() and any(p.exists() and os.path.samefile(p, root) for p in [candidate, *candidate.parents])
    if inside(target, source) or inside(source, target) or inside(target, kit) or inside(kit, target):
        raise ValueError('Source/target overlap refused')
    if not source.is_dir() or target.exists() or not target.parent.is_dir():
        raise ValueError('Missing source/parent or occupied target; preserved')
    m, old = baseline(kit)
    pkg, patches = source_profile(kit, source, old)
    assert_stopped(source)
    # Only an exact supported source reaches opaque fingerprinting/copying.
    rows = snapshot(source)
    pending = absolute_workspaces(pkg) + absolute_workspaces(patches)
    content = {'schemaVersion': 1, 'source': str(source), 'target': str(target), 'seedId': m['seedId'], 'validationRuntimeSha256': digest(validation_runtime(kit)), 'sourceFingerprint': sha(canonical(rows)), 'sourceEntries': len(rows), 'sourceFiles': sum(r['kind'] == 'file' for r in rows), 'absoluteWorkspaceReferencesPending': pending, 'opaqueWorkspaceReferencesInspected': False, 'workspaceLocationReviewRequired': True, 'absolutePathsRewritten': False, 'newMarketExpertEnabled': False, 'sourceOpenFileProbe': 'no-open-files-observed-PID-only', 'maintainerMustStopSelectedSource': True, 'sourceModified': False}
    return {**content, 'digest': sha(canonical(content))}


def exclusive_rename(source, target):
    # Darwin RENAME_EXCL is atomic and refuses even a newly-created empty target.
    lib = ctypes.CDLL(None, use_errno=True)
    fn = lib.renamex_np
    fn.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_uint]
    fn.restype = ctypes.c_int
    if fn(os.fsencode(source), os.fsencode(target), 4):
        raise OSError(ctypes.get_errno(), 'Exclusive target commit refused')


def apply(kit, plan, confirm_digest):
    if confirm_digest != plan.get('digest') or preview(kit, plan['source'], plan['target']) != plan:
        raise ValueError('Digest mismatch or stale preview; preserved')
    kit, source, target = Path(kit).absolute(), Path(plan['source']), Path(plan['target'])
    m, old = baseline(kit)
    pkg, patches = source_profile(kit, source, old)
    stage = Path(tempfile.mkdtemp(prefix='.qcu-migrate-', dir=target.parent))
    try:
        # Opaque persistent files remain local; caches/locks are never opened or copied.
        copy_opaque(source, stage)
        profile = stage / 'profiles/desktop'
        seed = kit / 'seed/profiles/desktop'
        shutil.rmtree(profile / 'node_modules')
        shutil.copytree(seed / 'node_modules', profile / 'node_modules')
        shutil.copytree(seed / '.qcu-bundles', profile / '.qcu-bundles')
        shutil.copy2(seed / 'pnpm-workspace.yaml', profile / 'pnpm-workspace.yaml')
        pkg['dependencies'] = {p['id']: p['source'] for p in m['localSources']}
        # Preserve original bundle choices. Newly available capabilities remain unselected.
        for id in ['qcu-market', 'qcu-expert-teams']:
            patches.append({'id': id, 'disabled': True, **({'config': {'enabled': True}} if id == 'qcu-expert-teams' else {})})
        if not any(r.get('id') == 'qcu-branding' for r in patches):
            patches.append({'id': 'qcu-branding', 'disabled': 'qcu-branding' not in pkg['dsh']['profile']['bundles']})
        branding_active = 'qcu-branding' in pkg['dsh']['profile']['bundles'] and not next(r for r in patches if r.get('id') == 'qcu-branding').get('disabled', False)
        for id in ['ui-brand-official', 'ui-sidebar'] if branding_active else []:
            row = next((r for r in patches if r.get('id') == id), None)
            if row is None:
                row = {'id': id}
                patches.append(row)
            row['disabled'] = True
        feishu = next(r for r in patches if r.get('id') == 'qcu-feishu-readonly')
        if feishu.get('config', {}).get('cliPath') == str(source / 'bin/lark-cli'):
            feishu['config']['cliPath'] = str(target / 'bin/lark-cli')
        for name, value in [('package.json', pkg), ('cordis.patch.yml', patches)]:
            (profile / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
        receipt = {'version': m['version'], 'seedId': m['seedId'], 'products': [{k: p[k] for k in ['id', 'version']} for p in m['products']], 'localSources': [{k: p[k] for k in ['id', 'source', 'sha256']} for p in m['localSources']], 'packageManagerInvoked': False, 'migration': {'previewDigest': plan['digest'], 'absoluteWorkspaceReferencesPending': plan['absoluteWorkspaceReferencesPending'], 'opaqueWorkspaceReferencesInspected': False, 'workspaceLocationReviewRequired': True}}
        (stage / 'qcu-teacher.json').write_text(json.dumps(receipt, indent=2) + '\n')
        # A fresh preview catches source changes during the copy, and rechecks stopped/target.
        if preview(kit, source, target) != plan:
            raise ValueError('Source changed during copy; preserved')
        # Validate exactly the same rc4 integrity gates used by subsequent native launches.
        runtime = validation_runtime(kit)
        env = {'PATH': os.environ.get('PATH', '/usr/bin:/bin'), 'HOME': os.environ['HOME'], 'ELECTRON_RUN_AS_NODE': '1', 'QCU_TEACHER_TEST_HOME': str(stage)}
        result = subprocess.run([str(runtime), '--expose-internals', str(kit / 'support/start.cjs'), 'prepare', '--kit', str(kit)], capture_output=True, env=env, timeout=120)
        if result.returncode:
            raise ValueError('Migrated profile integrity check refused')
        assert_stopped(source)
        exclusive_rename(stage, target)
        return {'status': 'migrated-disposable-or-explicitly-authorized-source', 'digest': plan['digest'], 'sourceModified': False, 'newMarketExpertEnabled': False, 'absoluteWorkspaceReferencesPending': plan['absoluteWorkspaceReferencesPending'], 'opaqueWorkspaceReferencesInspected': False, 'workspaceLocationReviewRequired': True, 'absolutePathsRewritten': False}
    finally:
        if stage.exists():
            shutil.rmtree(stage)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['preview', 'apply'])
    parser.add_argument('--kit', type=Path, required=True)
    parser.add_argument('--source', type=Path)
    parser.add_argument('--target', type=Path)
    parser.add_argument('--preview-file', type=Path, required=True)
    parser.add_argument('--confirm-digest')
    args = parser.parse_args()
    try:
        if args.action == 'preview':
            if not args.source or not args.target:
                raise ValueError('Explicit source and new target required')
            plan = preview(args.kit, args.source, args.target)
            with args.preview_file.open('x') as stream:
                json.dump(plan, stream, ensure_ascii=False, indent=2)
            print(json.dumps(plan, ensure_ascii=False))
        else:
            print(json.dumps(apply(args.kit, json.loads(metadata(args.preview_file)), args.confirm_digest)))
    except Exception:
        # Exceptions may contain file names or parser snippets; emit only a safe fixed diagnosis.
        print('Migration refused; source preserved. Check paths, baseline, stopped state and preview digest.', file=sys.stderr)
        sys.exit(1)
