"""Explicit synthetic loopback fixture. No used Home or signing keys."""
import importlib.util
import json
from pathlib import Path
import tempfile
import threading
from http.server import BaseHTTPRequestHandler

REPO = Path(__file__).absolute().parents[2]
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, REPO / path); value = importlib.util.module_from_spec(spec); spec.loader.exec_module(value); return value
feedback = load('feedback', 'hub/feedback.py')
hub = load('hub', 'hub/release/serve-hub.py')
admin = load('admin', 'hub/admin/server.py')

class SyntheticHandler(admin.Handler):
    def reply(self, code, raw, content_type='application/json; charset=utf-8', attachment=None):
        if content_type.startswith('text/html'):
            raw = raw.replace(b'<body>', '<body><div class="boundary">P16 合成管理员预览：仅临时虚构数据，无生产 Key、真实反馈或线上状态。</div>'.encode())
        return super().reply(code, raw, content_type, attachment)

class SyntheticMaintenance:
    def status(self):
        return dict(configured=True, message='合成维护数据，非线上状态；生产检查须显式只读刷新。', lastCheck=getattr(self, 'last', None), publication={'configured':False})
    def refresh(self):
        # Honest parsed-only fixture, never pretends to possess publisher signatures.
        self.last = dict(schema=1, checkedAt='2026-10-27T00:00:00Z', source='synthetic-only', catalog=dict(verification='parsed-only',freshness='near-expiry',productCount=10,integrity='unobserved',http='not-checked'), updates=dict(verification='parsed-only',freshness='expired'), expertFeed=dict(state='supported-legacy-fallback'), failures=['synthetic-no-public-signature'], ok=False)
        return self.status()

if __name__ == '__main__':
    with tempfile.TemporaryDirectory(prefix='qcu-p16-preview-', dir='/private/tmp') as parent:
        root = Path(parent)
        box = feedback.Inbox(root / 'feedback', initialize=True)
        store = admin.Store(root / 'account', True, initial_password='synthetic-preview-password'); store.configure_feedback(box.root); store.maintenance = SyntheticMaintenance()
        public = hub.make_server({'/':b'<p>Synthetic feedback fixture</p>'}, port=0, feedback=feedback.Receiver(box)); private = admin.Server(('127.0.0.1',0),store); private.RequestHandlerClass = SyntheticHandler
        for server in [public,private]: threading.Thread(target=server.serve_forever,daemon=True).start()
        print(json.dumps({'feedback':'http://127.0.0.1:'+str(public.server_port),'admin':private.origin,'synthetic':True}),flush=True)
        try: threading.Event().wait()
        except KeyboardInterrupt: pass
        finally:
            for server in [public,private]: server.shutdown();server.server_close()
            store.close();box.close()
