"""Read-only maintenance subprocess. Configuration is operator supplied, never Web."""
import json
from pathlib import Path
import subprocess


class Maintenance:
    def __init__(self, root, node, publication=None):
        if not Path(node).is_absolute() or not Path(node).is_file() or not Path(root).is_absolute():
            raise ValueError('maintenance.configuration')
        self.root, self.node, self.publication, self.last = str(root), str(node), publication, None

    def status(self):
        return {'configured': True, 'message': '仅点击刷新时检查固定公开地址；未执行自动续期或发布。', 'lastCheck': self.last,
                'publication': self.publication.status() if self.publication else {'configured': False, 'state': 'unconfigured'}}

    def refresh(self):
        script = Path(__file__).absolute().parents[2] / 'scripts/audit-product-polish.mjs'
        result = subprocess.run([self.node, str(script), '--root', self.root, '--http'], capture_output=True, timeout=20,
                                env={'PATH': '/usr/bin:/bin'}, cwd='/')
        if len(result.stdout) > 131072 or result.returncode not in (0, 2):
            raise ValueError('maintenance.failed')
        self.last = json.loads(result.stdout)
        return self.status()
