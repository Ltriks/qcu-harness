"""Trusted synthetic-only browser fixture; never use for real account setup."""
import argparse
import importlib.util
from pathlib import Path
import time

spec = importlib.util.spec_from_file_location('admin', Path(__file__).resolve().parents[2] / 'hub/admin/server.py')
admin = importlib.util.module_from_spec(spec)
spec.loader.exec_module(admin)
parser = argparse.ArgumentParser()
parser.add_argument('--state-root', required=True, type=Path)
parser.add_argument('--initialize', action='store_true')
args = parser.parse_args()
# Explicit synthetic fixture in source, never a password flag, env var or real credential.
offset = args.state_root.parent / 'synthetic-clock-offset'
clock = lambda: time.monotonic() + float(offset.read_text())
store = admin.Store(args.state_root, args.initialize,
                    initial_password='Synthetic-only-admin-2026!' if args.initialize else None, clock=clock)
server = admin.Server(('127.0.0.1', 0), store)
try:
    print('Local preparation only: ' + server.origin, flush=True)
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
    store.close()
