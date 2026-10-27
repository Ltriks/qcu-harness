"""Source-only contracts. Synthetic reviewed inputs stay in disposable test directories."""
import argparse
import gzip
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


pins = module('prep_pins', 'scripts/generate-integrated-teacher-macos-config.py')
builder = module('prep_builder', 'scripts/build-integrated-teacher-macos.py')
verifier = module('prep_verifier', 'scripts/verify-integrated-teacher-macos.py')


class PrepContracts(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='qcu-source-prep-synthetic-', dir='/private/tmp')
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)

    def bundle(self, id='qcu-branding', version='0.2.6-pilot.2', metadata=None, extra=None, transform=None):
        pkg = {'name': id, 'version': version, 'type': 'module'}
        if id == 'qcu-market':
            pkg['peerDependencies'] = pins.MARKET_PEERS.copy()
        pkg.update(metadata or {})
        files = {'package.json': json.dumps(pkg).encode(), 'index.js': b'// SYNTHETIC; never executed\n',
                 'client.js': b'// SYNTHETIC; never executed\n', 'cordis.patch.yml': b'[]\n',
                 'LICENSE': b'SYNTHETIC TEST INPUT\n', 'icon.svg': b'<svg/>\n'}
        files.update(extra or {})
        data = pins.SOURCES.branding_archive(files)
        if transform:
            data = transform(files, data)
        folder = self.root / (id + '-' + version)
        folder.mkdir(exist_ok=True)
        digest = pins.sha(data)
        archive = folder / f'{id}-{version}-{digest}.tgz'
        archive.write_bytes(data)
        manifest = {'id': id, 'version': version, 'file': archive.name, 'bytes': len(data),
                    'sha256': digest, 'runtime': pins.CORE, 'files': [
                        {'path': 'package/' + name, 'bytes': len(value), 'sha256': pins.sha(value)}
                        for name, value in sorted(files.items())]}
        if id == 'qcu-market':
            manifest['package'] = manifest.pop('id')
            manifest.pop('runtime')
            manifest['peerDependencies'] = pkg['peerDependencies']
            manifest['scripts'] = {}
            for row in manifest['files']:
                row['mode'] = '0644'
        target = folder / 'MANIFEST.json'
        target.write_text(json.dumps(manifest))
        return target, archive, manifest

    def inspect(self, manifest, archive, id='qcu-branding', version='0.2.6-pilot.2'):
        return pins.inspect_package(manifest, archive, id, version, pins.file_pin(manifest)['sha256'])

    def arguments(self, theme='0.2.6-pilot.2'):
        bm, ba, _ = self.bundle(version=theme)
        mm, ma, _ = self.bundle('qcu-market', '0.1.0-pilot.16.1')
        return argparse.Namespace(base_config=ROOT / 'release/integrated-teacher-macos-rc42.json',
            branding_manifest=bm, branding_archive=ba, branding_manifest_sha256=pins.file_pin(bm)['sha256'],
            branding_version=theme, market_manifest=mm, market_archive=ma,
            market_manifest_sha256=pins.file_pin(mm)['sha256'],
            course_manifest=pins.FIXED_ROOT / 'qcu-course-workbench/MANIFEST.json',
            expert_manifest=pins.FIXED_ROOT / 'qcu-expert-teams/MANIFEST.json',
            output=self.root / 'synthetic-config.json', staging=self.root / 'synthetic-theme')

    def test_original_twelve_pins_and_frozen_font_archives_read_only(self):
        config, paths = pins.original_config(ROOT / 'release/integrated-teacher-macos-rc42.json')
        self.assertEqual(len(paths), 12)
        self.assertEqual(config['customAsarSha256'], pins.CUSTOM_ASAR)
        for id in pins.FIXED:
            product, files = pins.fixed_package(id)
            self.assertEqual(product['sha256'], pins.FIXED[id][2])
            self.assertIn('client.js', files)

    def test_generator_to_builder_input_pipeline_for_both_explicit_themes(self):
        for theme in pins.RELEASES[pins.VERSION]:
            with self.subTest(theme=theme):
                args = self.arguments(theme)
                args.output = self.root / (theme + '.json')
                args.staging = self.root / ('stage-' + theme)
                archive_dir = self.root / ('explicit-market-archive-' + theme)
                archive_dir.mkdir()
                target = archive_dir / args.market_archive.name
                args.market_archive.rename(target)
                args.market_archive = target
                result = pins.generate(args)
                self.assertTrue(result['brandingDeterministicRepackByteIdentical'])
                self.assertEqual(result['originalPinsChecked'], 12)
                config = json.loads(args.output.read_text())
                prepared = builder.prepare_inputs(config)
                self.assertEqual(len(prepared[5]), 12)
                theme_row = next(p for p in prepared[5] if p['id'] == 'qcu-branding')
                self.assertEqual(prepared[4]['qcu-branding'], args.branding_archive.read_bytes())
                self.assertEqual(theme_row['file'], args.branding_archive.name)
                release = {'version': pins.VERSION, 'seedId': 'a' * 64, 'localSources': prepared[5],
                           'branding': {'id': 'qcu-branding', 'version': theme}}
                docs = self.root / ('docs-' + theme)
                docs.mkdir()
                builder.write_guides(docs, config, release)
                self.assertIn(theme, (docs / 'QCU助手使用指南.html').read_text())
                self.assertEqual(json.loads((docs / 'composition.json').read_text()), builder.composition(release))
                self.assertNotIn('/Users/', ''.join(p.read_text() for p in docs.iterdir()))
                self.assertFalse(any(p.is_dir() for p in docs.iterdir()))
                self.assertEqual(set(builder.SHIP_FILES) - {'QCU助手.app'}, {p.name for p in docs.iterdir()})
                # A supplied exact pin never authorizes repair/overwrite of an existing output.
                with self.assertRaisesRegex(ValueError, 'Fresh config'):
                    pins.generate(args)
                # Builder independently rejects edits after config generation.
                bad = json.loads(args.output.read_text())
                bad['marketManifest'] = bad['expertManifest']
                with self.assertRaisesRegex(ValueError, 'alias mismatch'):
                    builder.prepare_inputs(bad)
                staged_extra = args.staging / 'qcu-branding/unreviewed.js'
                staged_extra.write_text('// never bundled')
                with self.assertRaisesRegex(ValueError, 'unexpected source'):
                    builder.prepare_inputs(config)
                staged_extra.unlink()
                config['trustedRuntime']['sha256'] = '0' * 64
                with self.assertRaises(ValueError):
                    builder.prepare_inputs(config)

    def test_no_output_before_rejected_reviewed_manifest_and_version(self):
        args = self.arguments('0.2.6-pilot.3')
        args.branding_version = '0.2.6-pilot.2'
        with self.assertRaises(ValueError):
            pins.generate(args)
        self.assertFalse(args.output.exists())
        self.assertFalse(args.staging.exists())
        args.branding_version = '0.2.6-pilot.3'
        args.market_manifest_sha256 = '0' * 64
        with self.assertRaisesRegex(ValueError, 'hash mismatch'):
            pins.generate(args)
        self.assertFalse(args.staging.exists())

    def test_no_arbitrary_release_theme_policy_or_original_config(self):
        for version, theme in [('0.1.0-rc.4.4', '0.2.6-pilot.2'), (pins.VERSION, '0.2.6-pilot.1'),
                               (pins.VERSION, '9.9.9'), (pins.VERSION, None), ('0.1.0-rc.4.2', '0.2.6-pilot.2')]:
            c = {'version': version, 'target': 'mac-arm64', 'packagePolicy': pins.POLICY}
            if theme:
                c['brandingVersion'] = theme
            with self.assertRaises(ValueError):
                pins.theme_version(c)
        tampered = self.root / 'base.json'
        tampered.write_text((ROOT / 'release/integrated-teacher-macos-rc42.json').read_text() + ' ')
        with self.assertRaisesRegex(ValueError, 'hash mismatch'):
            pins.original_config(tampered)

    def test_rejects_executable_dependency_and_peer_metadata(self):
        for field, value in [('scripts', {'postinstall': 'never-run'}), ('dependencies', {'x': '1'}),
                             ('optionalDependencies', {'x': '1'}), ('bundledDependencies', ['x']),
                             ('devDependencies', {'x': '1'}), ('peerDependenciesMeta', {'x': {'optional': True}}),
                             ('peerDependencies', {'@deepseek-ai/cordis': '^4.0.4'}),
                             ('peerDependencies', {'unknown-host': pins.CORE})]:
            with self.subTest(field=field, value=value):
                m, a, _ = self.bundle(metadata={field: value})
                with self.assertRaises(ValueError):
                    self.inspect(m, a)

    def test_market_requires_complete_exact_manifest_and_package_peers(self):
        for peers in [{}, {'@deepseek-ai/cordis': '4.0.4'}, {**pins.MARKET_PEERS, 'invented-host': pins.CORE}]:
            with self.subTest(peers=peers):
                m, a, _ = self.bundle('qcu-market', '0.1.0-pilot.16.1', metadata={'peerDependencies': peers})
                with self.assertRaises(ValueError):
                    self.inspect(m, a, 'qcu-market', '0.1.0-pilot.16.1')
        m, a, manifest = self.bundle('qcu-market', '0.1.0-pilot.16.1')
        manifest.pop('peerDependencies')
        m.write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ValueError, 'Exact market'):
            self.inspect(m, a, 'qcu-market', '0.1.0-pilot.16.1')

    def test_parent_supplied_real_market_manifest_and_exact_tgz_read_only_pipeline(self):
        manifest = Path('/Users/mcq/Repos/worktrees/qcu-harness/teacher-product-polish/.work/product-polish-review/packages/final/qcu-market/MANIFEST.json')
        expected_manifest_sha = '73e0c43cac7f07fe7b6f15cef1b54eb05ecdf44b5ce63c3695a7b2be013e16c8'
        raw = pins.read_json(manifest, expected_manifest_sha)
        archive = manifest.parent / raw['file']
        before = [pins.file_pin(p) for p in (manifest, archive)]
        product, files, unchanged = pins.inspect_package(manifest, archive, 'qcu-market', '0.1.0-pilot.16.1', expected_manifest_sha)
        self.assertNotIn('runtime', unchanged)
        self.assertNotIn('id', unchanged)
        self.assertEqual(unchanged['package'], 'qcu-market')
        self.assertEqual(len(files), 24)
        self.assertEqual((product['bytes'], product['sha256']), (86354, 'fc25da801af9da4c583225c95352547791c5eb59feb4bc2febdfd2f8df0d6f8f'))
        args = self.arguments('0.2.6-pilot.3')
        args.market_manifest, args.market_archive, args.market_manifest_sha256 = manifest, archive, expected_manifest_sha
        pins.generate(args)
        prepared = builder.prepare_inputs(json.loads(args.output.read_text()))
        self.assertEqual(prepared[4]['qcu-market'], archive.read_bytes())
        self.assertEqual(next(p for p in prepared[5] if p['id'] == 'qcu-market'), product)
        self.assertEqual(before, [pins.file_pin(p) for p in (manifest, archive)])

    def test_rejects_member_inventory_tampering(self):
        for kind in ['duplicate', 'missing', 'hash', 'traversal', 'prefix', 'archive-hash', 'runtime', 'id', 'version']:
            with self.subTest(kind=kind):
                m, a, manifest = self.bundle()
                if kind == 'duplicate': manifest['files'].append(manifest['files'][0])
                if kind == 'missing': manifest['files'].pop()
                if kind == 'hash': manifest['files'][0]['sha256'] = '0' * 64
                if kind == 'traversal': manifest['files'][0]['path'] = 'package/../bad'
                if kind == 'prefix': manifest['files'][0]['path'] = 'LICENSE'
                if kind == 'archive-hash': manifest['sha256'] = '0' * 64
                if kind in ('runtime', 'id', 'version'): manifest[kind] = 'wrong'
                m.write_text(json.dumps(manifest))
                with self.assertRaises(ValueError): self.inspect(m, a)

    def test_rejects_non_plain_tar_and_non_deterministic_theme(self):
        def tar_mutation(kind):
            def transform(files, original):
                raw = io.BytesIO()
                with tarfile.open(fileobj=raw, mode='w', format=tarfile.PAX_FORMAT if kind == 'pax' else tarfile.USTAR_FORMAT) as t:
                    for index, (name, data) in enumerate(sorted(files.items())):
                        info = tarfile.TarInfo('package/' + name)
                        info.size, info.mode = len(data), 0o644
                        if index == 0:
                            if kind == 'symlink': info.type, info.linkname = tarfile.SYMTYPE, '/tmp/never-follow'
                            if kind == 'hardlink': info.type, info.linkname = tarfile.LNKTYPE, 'package/client.js'
                            if kind == 'directory': info.type = tarfile.DIRTYPE
                            if kind == 'mode': info.mode = 0o755
                            if kind == 'pax': info.pax_headers = {'comment': 'extension refused'}
                        t.addfile(info, io.BytesIO(data) if info.isfile() else None)
                        if index == 0 and kind == 'duplicate': t.addfile(info, io.BytesIO(data))
                return gzip.compress(raw.getvalue(), mtime=1 if kind == 'timestamp' else 0)
            return transform
        for kind in ['symlink', 'hardlink', 'directory', 'mode', 'pax', 'duplicate', 'timestamp']:
            with self.subTest(kind=kind):
                m, a, _ = self.bundle(transform=tar_mutation(kind))
                with self.assertRaises(ValueError): self.inspect(m, a)
        m, a, _ = self.bundle(extra={'extra.js': b'// extra'})
        with self.assertRaisesRegex(ValueError, 'six-file'): self.inspect(m, a)

    def test_symlink_inputs_and_outputs_are_preserved(self):
        args = self.arguments()
        link = self.root / 'linked-manifest.json'
        link.symlink_to(args.branding_manifest)
        with self.assertRaisesRegex(ValueError, 'symlink'):
            self.inspect(link, args.branding_archive)
        args.staging.symlink_to(self.root / 'untouched')
        with self.assertRaisesRegex(ValueError, 'symlink'):
            pins.generate(args)
        self.assertTrue(args.staging.is_symlink())

    def test_actual_small_ditto_zip_inventory_unicode_permissions_and_links(self):
        payload = self.root / '中文 payload'
        payload.mkdir()
        (payload / 'nested').mkdir()
        (payload / 'nested/说明.txt').write_text('Synthetic archive inventory only')
        (payload / 'nested/说明.txt').chmod(0o755)
        (payload / 'link').symlink_to('nested/说明.txt')
        archive = self.root / (payload.name + '.zip')
        subprocess.run(['/usr/bin/ditto', '-c', '-k', '--norsrc', '--keepParent', payload, archive], check=True)
        rows = builder.inventory(payload)
        verifier.verify_zip_inventory(archive, rows)
        with zipfile.ZipFile(archive, 'a') as z:
            z.writestr(payload.name + '/../escape.txt', 'never extracted')
        with self.assertRaises(ValueError):
            verifier.verify_zip_inventory(archive, rows)

    def test_native_probe_preserves_exact_empty_nonzero_timeout_and_success_results(self):
        for kind in ['nonzero-empty', 'timeout', 'refused', 'zero-without-token', 'passed']:
            with self.subTest(kind=kind):
                def fake_run(command, **options):
                    self.assertEqual(command, [str(self.root / 'Contents/MacOS/城院助手'), '--prepare-only'])
                    self.assertEqual(options['timeout'], 30)
                    if kind == 'timeout': raise subprocess.TimeoutExpired(command, 30)
                    if kind == 'refused': raise PermissionError(13, 'synthetic refusal')
                    if kind == 'passed': options['stdout'].write('QCU_TEACHER_RESULT:{"result":"prepared"}\n')
                    return subprocess.CompletedProcess(command, 17 if kind == 'nonzero-empty' else 0)
                with patch.object(verifier.subprocess, 'run', fake_run):
                    row = verifier.native_preparation_probe(self.root, self.root, 'native-first', {})
                if kind == 'nonzero-empty':
                    self.assertEqual(row, {'name': 'native-first', 'exitCode': 17, 'stdoutBytes': 0, 'stderrBytes': 0,
                        'stdoutLog': 'native-first.stdout.log', 'stderrLog': 'native-first.stderr.log', 'status': 'failed'})
                elif kind == 'timeout': self.assertEqual(row['status'], 'timeout')
                elif kind == 'refused': self.assertEqual(row['errno'], 13)
                else: self.assertEqual(row['status'], 'passed' if kind == 'passed' else 'failed')


if __name__ == '__main__':
    unittest.main()
