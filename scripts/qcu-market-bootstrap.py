"""Preview, then explicitly confirm, a pinned static Hub's reviewed teacher products.

Local operator only. Does not fetch trust, execute products, or change DSH profiles.
"""
import argparse
import importlib.util
import json
import tarfile
from pathlib import Path

REPO = Path(__file__).absolute().parents[1]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('state-root', 'publication-root', 'public-trust', 'node', 'static-root', 'seed-catalog'):
        parser.add_argument('--' + name, required=True, type=Path)
    parser.add_argument('--manifest-sha256', required=True)
    parser.add_argument('--confirm-preview', help='Exact digest from a separately inspected preview; omitting only previews')
    args = parser.parse_args()
    admin = load('bootstrap_admin', REPO / 'hub/admin/server.py')
    hub = load('bootstrap_static', REPO / 'hub/release/serve-hub.py')
    store = None
    try:
        resources = hub.load_snapshot(args.static_root, args.manifest_sha256)
        seed = hub.read_regular(args.seed_catalog, 262144)
        trust = admin.parse(hub.read_regular(args.public_trust, 4096), 4096)
        store = admin.Store(args.state_root)
        publication = store.configure_publication(args.publication_root, trust, args.node)
        value = publication.bootstrap(resources, args.manifest_sha256, seed, args.confirm_preview) if args.confirm_preview else publication.bootstrap_preview(resources, args.manifest_sha256, seed)
        print(json.dumps(value, ensure_ascii=False, indent=2))
        return 0
    except (admin.Refused, OSError, ValueError, KeyError, TypeError, tarfile.TarError):
        print('bootstrap.refused')
        return 2
    finally:
        if store:
            store.close()


if __name__ == '__main__':
    raise SystemExit(main())
