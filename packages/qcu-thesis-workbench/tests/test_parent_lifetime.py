"""Synthetic subprocess lifetime tests; no user files, models, or external requests."""
import ctypes
import json
import os
from pathlib import Path
import selectors
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from test_workbench import fixture

PACKAGE = Path(__file__).resolve().parents[1]
RUNTIME = PACKAGE / 'runtime'
NODE = os.environ.get('QCU_TEST_NODE')
TSX = os.environ.get('QCU_TEST_TSX')
LINUX = sys.platform == 'linux'


def wait_for(predicate, seconds=5):
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        if predicate():
            return
        time.sleep(0.02)
    raise AssertionError('Synthetic process condition did not settle within its deadline')


@unittest.skipIf(os.name == 'nt', 'Pipe fixture observation is POSIX-only; Windows acceptance is separate')
class ParentLifetimeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if LINUX:
            # Only this test supervisor reaps the intentionally orphaned fixtures.
            # Production never adopts a process or signals a recorded PID.
            if ctypes.CDLL(None, use_errno=True).prctl(36, 1, 0, 0, 0) != 0:
                raise RuntimeError('Cannot enable synthetic descendant reaping')

    def setUp(self):
        self.root = tempfile.TemporaryDirectory(prefix='qcu-parent-lifetime-')
        self.addCleanup(self.root.cleanup)
        self.children = []
        self.homes = []
        self.addCleanup(self.cleanup_processes)

    def cleanup_processes(self):
        for home in self.homes:
            (home / 'sibling-stop').touch()
        for child in self.children:
            if child.poll() is None:
                child.terminate()  # A captured subprocess handle, never a PID record.
                try:
                    child.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    child.kill()
                    child.wait(timeout=3)
            for stream in (child.stdin, child.stdout, child.stderr):
                if stream:
                    stream.close()
        if LINUX:
            for home in self.homes:
                for name in ('python-pid', 'sibling-pid'):
                    path = home / name
                    if path.exists():
                        self.reap(int(path.read_text()), timeout=15)

    def reap(self, pid, timeout=5):
        status = []

        def exited():
            try:
                waited, code = os.waitpid(pid, os.WNOHANG)
            except ChildProcessError:
                return True  # Already reaped through its captured Popen handle.
            if waited:
                status.append(os.waitstatus_to_exitcode(code))
                return True
            return False

        wait_for(exited, timeout)
        return status[0] if status else None

    def setup_runtime(self, behavior='normal'):
        home = Path(self.root.name) / ('private 中文 home ' + str(len(self.homes)))
        home.mkdir(mode=0o700)
        self.homes.append(home)
        wrapper = home.parent / (home.name + '.py')
        # The independent self-only emergency timer makes intentional-regression
        # tests leak-free even when the implementation under test has no watcher.
        wrapper.write_text(f'''
import os, signal, sys, threading
from pathlib import Path
sys.path.insert(0, {str(RUNTIME)!r})
home = Path({str(home)!r})
(home / 'python-pid').write_text(str(os.getpid()))
def emergency_stop():
    signal.raise_signal(signal.SIGTERM)
for delay, action in ((12, emergency_stop), (13, lambda: os._exit(97))):
    timer = threading.Timer(delay, action)
    timer.daemon = True
    timer.start()
import server
behavior = {behavior!r}
if behavior == 'startup':
    def blocked_create(*args):
        (home / 'startup-entered').touch()
        threading.Event().wait(60)
    server.create_server = blocked_create
elif behavior == 'serve':
    def blocked_serve(self, *args, **kwargs):
        (home / 'serve-entered').touch()
        threading.Event().wait(60)
    server.WorkbenchServer.serve_forever = blocked_serve
elif behavior == 'check':
    def blocked_check(*args):
        (home / 'check-entered').touch()
        threading.Event().wait(60)
    server.check = blocked_check
elif behavior == 'stdin-error':
    reader, writer = os.pipe()
    os.dup2(writer, 0)  # A write-only stdin yields a real EBADF after Python startup.
    os.close(reader)
    os.close(writer)
server.main()
''', encoding='utf-8')
        return home, wrapper

    def direct(self, behavior='normal', parent=True, stdin=subprocess.PIPE):
        home, wrapper = self.setup_runtime(behavior)
        child = subprocess.Popen([sys.executable, '-B', '-u', str(wrapper), '--home', str(home),
                                  '--port', '0', *(['--parent-stdin'] if parent else [])],
                                 stdin=stdin, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        self.children.append(child)
        return child, home

    def ready(self, child):
        with selectors.DefaultSelector() as selector:
            selector.register(child.stdout, selectors.EVENT_READ)
            self.assertTrue(selector.select(5), 'No readiness record')
        line = child.stdout.readline()
        self.assertTrue(line, 'Service exited before readiness')
        return json.loads(line)['url']

    def bridge(self, home):
        return json.loads((home / 'bridge.json').read_text())

    def probe(self, url, home):
        bridge = self.bridge(home)
        with self.assertRaises(HTTPError) as error:
            urlopen(Request(url + '/bridge/run', data=b'{}', headers={
                'Content-Type': 'application/json', 'X-QCU-Bridge': bridge['token'],
            }), timeout=1)
        self.assertEqual(error.exception.code, 400)
        self.assertEqual(json.loads(error.exception.read())['error'], '仅接受文档编号和规则编号。')

    def disconnected(self, url):
        with self.assertRaises((URLError, OSError)):
            urlopen(url, timeout=0.5)

    def no_owned_files(self, home):
        self.assertFalse((home / 'server.lock').exists())
        self.assertFalse((home / 'bridge.json').exists())

    def eof(self, child):
        child.stdin.close()
        child.stdin = None

    def test_eof_closes_listener_and_owned_files(self):
        child, home = self.direct()
        url = self.ready(child)
        self.probe(url, home)
        self.eof(child)
        self.assertEqual(child.wait(timeout=4.5), 0)
        self.disconnected(url)
        self.no_owned_files(home)

    def test_standalone_ignores_closed_stdin_and_normal_shutdown_cleans(self):
        child, home = self.direct(parent=False, stdin=subprocess.DEVNULL)
        url = self.ready(child)
        time.sleep(0.25)
        self.assertIsNone(child.poll())
        self.probe(url, home)
        bridge = self.bridge(home)
        with urlopen(Request(url + '/bridge/shutdown', data=b'{}', headers={
            'Content-Type': 'application/json', 'X-QCU-Bridge': bridge['token'],
        }), timeout=1) as response:
            self.assertEqual(response.status, 200)
        self.assertEqual(child.wait(timeout=4.5), 0)
        self.no_owned_files(home)

    def test_eof_before_readiness_leaves_no_owned_files(self):
        child, home = self.direct(stdin=subprocess.DEVNULL)
        self.assertEqual(child.wait(timeout=4.5), 0)
        self.no_owned_files(home)
        # EOF is observed asynchronously; even if startup won the race to emit
        # readiness, the process and its listener must already be gone.
        record = child.stdout.read()
        if record:
            self.disconnected(json.loads(record)['url'])

    def test_stdin_read_error_fails_closed(self):
        child, home = self.direct(behavior='stdin-error')
        self.assertEqual(child.wait(timeout=4.5), 0)
        self.no_owned_files(home)

    def test_unexpected_stdin_bytes_are_discarded_without_commands_or_logs(self):
        child, home = self.direct()
        url = self.ready(child)
        child.stdin.write(b'synthetic-private-canary\nshutdown\n' * 64)
        child.stdin.flush()
        time.sleep(0.1)
        self.probe(url, home)
        self.eof(child)
        self.assertEqual(child.wait(timeout=4.5), 0)
        self.assertNotIn(b'synthetic-private-canary', child.stderr.read() + child.stdout.read())
        self.no_owned_files(home)

    def test_parent_loss_bounds_blocked_startup_and_removes_lock(self):
        child, home = self.direct(behavior='startup')
        wait_for(lambda: (home / 'startup-entered').exists())
        started = time.monotonic()
        self.eof(child)
        self.assertEqual(child.wait(timeout=4.5), 0)
        self.assertLess(time.monotonic() - started, 4.5)
        self.no_owned_files(home)

    def test_parent_loss_bounds_blocked_serve_loop_and_removes_bridge(self):
        child, home = self.direct(behavior='serve')
        url = self.ready(child)
        wait_for(lambda: (home / 'serve-entered').exists())
        self.eof(child)
        self.assertEqual(child.wait(timeout=4.5), 0)
        self.disconnected(url)
        self.no_owned_files(home)

    def test_incomplete_http_body_does_not_delay_parent_loss(self):
        child, home = self.direct()
        url = self.ready(child)
        token = self.bridge(home)['token']
        port = int(url.rsplit(':', 1)[1])
        with socket.create_connection(('127.0.0.1', port), timeout=1) as request:
            request.sendall((f'POST /bridge/run HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\n'
                             f'X-QCU-Bridge: {token}\r\nContent-Type: application/json\r\n'
                             'Content-Length: 65536\r\n\r\n{').encode())
            time.sleep(0.1)
            self.eof(child)
            self.assertEqual(child.wait(timeout=4.5), 0)
            self.disconnected(url)
            self.no_owned_files(home)

    def test_inflight_document_check_does_not_delay_parent_loss(self):
        child, home = self.direct(behavior='check')
        url = self.ready(child)
        with urlopen(url + '/task', timeout=1) as response:
            cookie = response.headers['Set-Cookie'].split(';')[0]
        headers = {'Cookie': cookie, 'Origin': url, 'Content-Type': 'application/octet-stream'}
        with urlopen(Request(url + '/api/task/upload', data=fixture(), headers=headers), timeout=1) as response:
            document = json.load(response)
        rule = json.loads((PACKAGE / 'rules/demo.json').read_text())['id']
        data = json.dumps({'document_id': document['document_id'], 'rule_id': rule,
                           'local_authorized': True}).encode()
        headers['Content-Type'] = 'application/json'
        outcome = []

        def run_check():
            try:
                with urlopen(Request(url + '/api/task/run', data=data, headers=headers), timeout=5):
                    outcome.append('unexpected completion')
            except (OSError, URLError):
                outcome.append('connection closed')

        request = threading.Thread(target=run_check, daemon=True)
        request.start()
        try:
            wait_for(lambda: (home / 'check-entered').exists())
            self.eof(child)
            self.assertEqual(child.wait(timeout=4.5), 0)
            self.disconnected(url)
            self.no_owned_files(home)
        finally:
            request.join(timeout=6)
        self.assertFalse(request.is_alive())
        self.assertEqual(outcome, ['connection closed'])

    def test_replaced_or_modified_ownership_records_are_preserved(self):
        for name, change in (('server.lock', 'replace'), ('bridge.json', 'replace'),
                             ('bridge.json', 'edit'), ('bridge.json', 'symlink'),
                             ('bridge.json', 'mode')):
            if os.name == 'nt' and change in ('symlink', 'mode'):
                continue
            with self.subTest(name=name, change=change):
                child, home = self.direct()
                url = self.ready(child)
                path = home / name
                original = path.read_bytes()
                if change == 'replace':
                    replacement = home / 'replacement'
                    replacement.write_bytes(original)
                    replacement.chmod(0o600)
                    replacement.replace(path)
                elif change == 'edit':
                    path.write_bytes(b'{"replacement": true}')
                elif change == 'symlink':
                    target = home / 'foreign-target'
                    target.write_bytes(original)
                    path.unlink()
                    path.symlink_to(target)
                else:
                    path.chmod(0o644)
                current = path.read_bytes()
                self.eof(child)
                self.assertEqual(child.wait(timeout=4.5), 0)
                self.disconnected(url)
                self.assertEqual(path.read_bytes(), current)
                self.assertTrue((home / 'server.lock').exists())
                self.assertTrue((home / 'bridge.json').exists())

    def test_existing_unowned_bridge_is_not_overwritten(self):
        home, wrapper = self.setup_runtime()
        (home / 'bridge.json').write_bytes(b'foreign bridge')
        child = subprocess.Popen([sys.executable, '-B', str(wrapper), '--home', str(home)],
                                 stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        self.children.append(child)
        self.assertNotEqual(child.wait(timeout=4.5), 0)
        self.assertEqual((home / 'bridge.json').read_bytes(), b'foreign bridge')
        self.assertTrue((home / 'server.lock').exists())

    def test_existing_live_service_cannot_be_adopted_or_removed(self):
        independent, home = self.direct(parent=False, stdin=subprocess.DEVNULL)
        url = self.ready(independent)
        before = {name: (home / name).read_bytes() for name in ('server.lock', 'bridge.json')}
        contender = subprocess.Popen([sys.executable, '-B', str(RUNTIME / 'server.py'), '--home', str(home),
                                      '--parent-stdin'], stdin=subprocess.PIPE,
                                     stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        self.children.append(contender)
        self.assertEqual(contender.wait(timeout=4.5), 2)
        self.assertEqual(before, {name: (home / name).read_bytes() for name in before})
        self.assertIsNone(independent.poll())
        self.probe(url, home)

    @unittest.skipUnless(LINUX and NODE and TSX, 'Actual Host SIGKILL requires Linux reaping and explicit Node/tsx')
    def test_real_qcu_host_sigkill_closes_owned_python_but_not_independent_service(self):
        independent, other_home = self.direct(parent=False, stdin=subprocess.DEVNULL)
        other_url = self.ready(independent)
        child, home = self.host(sibling=True)
        url = self.ready(child)
        self.probe(url, home)
        wait_for(lambda: (home / 'sibling-alive').exists())
        sibling_before = (home / 'sibling-alive').read_text()
        pid = int((home / 'python-pid').read_text())
        child.kill()
        self.assertEqual(child.wait(timeout=3), -9)
        self.assertEqual(self.reap(pid, timeout=4.5), 0)
        self.disconnected(url)
        self.no_owned_files(home)
        self.assertIsNone(independent.poll())
        self.probe(other_url, other_home)
        wait_for(lambda: (home / 'sibling-alive').read_text() != sibling_before)

    def host(self, behavior='normal', sibling=False):
        home, wrapper = self.setup_runtime(behavior)
        child = subprocess.Popen([NODE, '--import', TSX, str(PACKAGE / 'tests/fixtures/qcu-service-parent.ts'),
                                  sys.executable, str(wrapper), str(home), *(['sibling'] if sibling else [])],
                                 stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        self.children.append(child)
        return child, home

    @unittest.skipUnless(LINUX and NODE and TSX, 'Actual Host SIGKILL requires Linux reaping and explicit Node/tsx')
    def test_real_qcu_host_sigkill_before_readiness_is_bounded(self):
        child, home = self.host(behavior='startup')
        wait_for(lambda: (home / 'startup-entered').exists())
        pid = int((home / 'python-pid').read_text())
        child.kill()
        child.wait(timeout=3)
        self.assertEqual(self.reap(pid, timeout=4.5), 0)
        self.no_owned_files(home)

    @unittest.skipUnless(LINUX and NODE and TSX, 'Actual Host fixture requires explicit Node/tsx')
    def test_real_qcu_host_normal_stop_keeps_pipe_errors_quiet(self):
        child, home = self.host()
        url = self.ready(child)
        child.stdin.write(b'stop\n')
        child.stdin.flush()
        self.assertEqual(child.wait(timeout=5), 0)
        self.disconnected(url)
        self.no_owned_files(home)
        self.assertEqual(child.stderr.read(), b'')


if __name__ == '__main__':
    unittest.main(verbosity=2)
