"""Assemble an already-built developer executable; never launch or register it."""
from pathlib import Path
import hashlib
import plistlib
import shutil

root = Path(__file__).resolve().parents[1]
candidates = [p for p in (root / '.build').rglob('ChengyuanInstallerDemo') if p.is_file() and '.app' not in str(p)]
if len(candidates) != 1:
    raise SystemExit(f'Expected one built executable, found {len(candidates)}; run swift test first.')
app = root / '.build/artifacts/ChengyuanInstallerDemo.app'
if app.exists():
    raise SystemExit('Artifact already exists; preserve it or explicitly remove it before rebuilding.')
macos = app / 'Contents/MacOS'
macos.mkdir(parents=True)
binary = macos / 'ChengyuanInstallerDemo'
shutil.copy2(candidates[0], binary)
info = dict(CFBundleExecutable=binary.name, CFBundleIdentifier='org.chengyuan.installer.isolated-demo',
            CFBundleName='Chengyuan Installer Demo', CFBundlePackageType='APPL',
            CFBundleShortVersionString='0.0.1', CFBundleVersion='1', LSMinimumSystemVersion='14.0',
            NSHighResolutionCapable=True)
with (app / 'Contents/Info.plist').open('wb') as stream:
    plistlib.dump(info, stream)
print(app)
print('Executable SHA-256:', hashlib.sha256(binary.read_bytes()).hexdigest())
print('No URL registration, launch, signing or notarization performed.')
