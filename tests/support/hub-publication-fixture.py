"""Disposable full administrator/public server fixture, synthetic account and key only."""
from pathlib import Path
import json
import signal
import sys

sys.path.insert(0, str(Path(__file__).absolute().parents[1]))
from test_qcu_hub_publication import PublicationTest, admin

fixture = PublicationTest()
fixture.setUp()
server = admin.Server(('127.0.0.1', 0), fixture.store)
signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))
try:
    print(json.dumps(dict(admin=server.origin, public=fixture.trust['origin'], trust=fixture.trust,
                         handoff=str(fixture.root / 'handoff'), root=str(fixture.root))), flush=True)
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
    fixture.tearDown()
