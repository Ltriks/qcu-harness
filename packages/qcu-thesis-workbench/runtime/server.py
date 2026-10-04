"""Loopback-only teacher workbench and a narrow DSH bridge."""
import argparse
import hashlib
import hmac
import json
import os
import re
import secrets
import signal
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from engine import Document, InputError, MAX_UPLOAD, check, report_html, validate_rule

ROOT = Path(__file__).resolve().parents[1]
ID = re.compile(r'^[a-zA-Z0-9-]{1,100}$')


def write_json(path, value):
    with Path(path).open('x', encoding='utf-8') as f:
        json.dump(value, f, ensure_ascii=False, indent=2)


class Store:
    def __init__(self, home):
        self.home = Path(home).resolve()
        self.home.mkdir(parents=True, exist_ok=True, mode=0o700)
        for folder in ('documents', 'reports', 'rules'):
            (self.home / folder).mkdir(exist_ok=True, mode=0o700)
        self.lock = threading.RLock()

    def path(self, folder, ident, suffix):
        if not isinstance(ident, str) or not ID.fullmatch(ident):
            raise InputError('编号格式错误。')
        return self.home / folder / (ident + suffix)

    def rules(self):
        items = [validate_rule(json.loads(p.read_text(encoding='utf-8'))) for p in sorted((ROOT / 'rules').glob('*.json'))]
        for p in sorted((self.home / 'rules').glob('*.json')):
            items.append(validate_rule(json.loads(p.read_text(encoding='utf-8'))))
        return items

    def rule(self, ident):
        for rule in self.rules():
            if rule['id'] == ident:
                return rule
        raise InputError('规则不存在。')

    def save_rule(self, rule):
        if not isinstance(rule, dict):
            raise InputError('规则必须为对象。')
        rule = dict(rule)
        rule.update(id='personal-' + secrets.token_hex(8), source='personal', version='1')
        validate_rule(rule)
        with self.lock:
            write_json(self.path('rules', rule['id'], '.json'), rule)
        return rule

    def upload(self, data, chat_allowed=False, local_task=False):
        if local_task and chat_allowed:
            raise InputError('本机任务不接受对话或模型授权。')
        doc = Document(data)
        ident = secrets.token_hex(16)
        with self.lock:
            self.path('documents', ident, '.docx').write_bytes(data)
            write_json(self.path('documents', ident, '.json'),
                       dict(chat_allowed=chat_allowed, expires=time.time() + 86400,
                            **({'local_task': True} if local_task else {})))
        return dict(document_id=ident, overview=doc.overview(), chat_allowed=chat_allowed)

    def run(self, document_id, rule_id, bridge=False):
        source = self.path('documents', document_id, '.docx')
        if not source.exists():
            raise InputError('文档编号不存在，请先在本机页面选择论文。')
        if bridge:
            grant = json.loads(self.path('documents', document_id, '.json').read_text(encoding='utf-8'))
            if grant.get('local_task') or not grant['chat_allowed'] or grant['expires'] < time.time():
                raise InputError('该文档未授权对话检查或授权已过期，请在本机页面重新选择。')
        result = check(source.read_bytes(), self.rule(rule_id))
        report_id = secrets.token_hex(16)
        with self.lock:
            write_json(self.path('reports', report_id, '.json'), result)
            self.path('reports', report_id, '.html').write_text(report_html(result), encoding='utf-8')
        # Only this bounded projection is allowed across the model-facing bridge.
        return dict(report_id=report_id, counts=result['counts'], rule_source=result['rule']['source'], status='completed')

    def run_task(self, document_id, rule_id):
        if not isinstance(document_id, str) or not re.fullmatch(r'[0-9a-f]{32}', document_id):
            raise InputError('请在当前本机任务中重新选择 DOCX 文件。')
        grant = json.loads(self.path('documents', document_id, '.json').read_text(encoding='utf-8'))
        if (grant.get('local_task') is not True or grant.get('chat_allowed') is not False
                or grant.get('expires', 0) < time.time()):
            raise InputError('仅接受本机任务选择的文件，请重新选择后授权本次检查。')
        return self.run(document_id, rule_id)


class WorkbenchServer(ThreadingHTTPServer):
    daemon_threads = True


def create_server(home, port=0):
    store = Store(home)
    secret = secrets.token_urlsafe(32)
    session = secrets.token_urlsafe(32)

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass  # No document names, bodies, credentials or report excerpts in logs.

        @property
        def origin(self):
            return f'http://127.0.0.1:{self.server.server_port}'

        def allowed_host(self):
            return self.headers.get('Host') == f'127.0.0.1:{self.server.server_port}'

        def browser(self, write=False):
            cookie = self.headers.get('Cookie', '').split(';')
            valid = any(hmac.compare_digest(c.strip(), 'qcu_session=' + session) for c in cookie)
            return valid and (not write or self.headers.get('Origin') == self.origin)

        def send(self, code, data, content_type='application/json; charset=utf-8', cookie=False, download=False):
            if isinstance(data, (dict, list)):
                data = json.dumps(data, ensure_ascii=False).encode()
            elif isinstance(data, str):
                data = data.encode()
            self.send_response(code)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Referrer-Policy', 'no-referrer')
            self.send_header('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'")
            if cookie:
                self.send_header('Set-Cookie', 'qcu_session=' + session + '; HttpOnly; SameSite=Strict; Path=/')
            if download:
                self.send_header('Content-Disposition', 'attachment; filename="qcu-thesis-report.html"')
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            if not self.allowed_host():
                return self.send(403, {'error': '不允许的主机。'})
            route = urlsplit(self.path).path
            if route in ('/', '/task'):
                page = 'index.html' if route == '/' else 'task-panel.html'
                return self.send(200, (ROOT / 'web' / page).read_bytes(), 'text/html; charset=utf-8', cookie=True)
            if route in ('/app.js', '/app.css', '/task-panel.js', '/task-panel.css'):
                return self.send(200, (ROOT / 'web' / route[1:]).read_bytes(),
                                 'text/javascript; charset=utf-8' if route.endswith('.js') else 'text/css; charset=utf-8')
            if not self.browser():
                return self.send(403, {'error': '请从本机页面进入。'})
            try:
                if route == '/api/rules':
                    return self.send(200, store.rules())
                match = re.fullmatch(r'/reports/([0-9a-f]{32})(/download)?', route)
                if match:
                    return self.send(200, store.path('reports', match[1], '.html').read_bytes(),
                                     'text/html; charset=utf-8', download=bool(match[2]))
            except (OSError, ValueError):
                return self.send(404, {'error': '内容不存在或无法读取。'})
            return self.send(404, {'error': '没有此入口。'})

        def do_POST(self):
            if not self.allowed_host():
                return self.send(403, {'error': '不允许的主机。'})
            route = urlsplit(self.path).path
            bridge = route in ('/bridge/run', '/bridge/shutdown')
            if bridge:
                if not hmac.compare_digest(self.headers.get('X-QCU-Bridge', ''), secret):
                    return self.send(403, {'error': '对话通道未授权。'})
            elif not self.browser(write=True):
                return self.send(403, {'error': '只接受本机页面的同源操作。'})
            try:
                length = int(self.headers.get('Content-Length', '0'))
                limit = MAX_UPLOAD if route in ('/api/upload', '/api/task/upload') else 65536
                if length <= 0 or length > limit:
                    raise InputError('请求为空或超过大小限制。')
                self.connection.settimeout(30)
                raw = self.rfile.read(length)
                if len(raw) != length:
                    raise InputError('请求不完整。')
                if route in ('/api/upload', '/api/task/upload'):
                    if self.headers.get('Content-Type') != 'application/octet-stream':
                        raise InputError('文件上传类型错误。')
                    if route == '/api/task/upload':
                        if self.headers.get('X-QCU-Chat-Allowed') not in (None, 'false'):
                            raise InputError('本机任务不接受对话或模型授权。')
                        return self.send(200, store.upload(raw, chat_allowed=False, local_task=True))
                    return self.send(200, store.upload(raw, self.headers.get('X-QCU-Chat-Allowed') == 'true'))
                if self.headers.get('Content-Type') != 'application/json':
                    raise InputError('请求格式必须为 JSON。')
                data = json.loads(raw)
                if route == '/bridge/shutdown':
                    if data != {}:
                        raise InputError('停止请求必须为空对象。')
                    self.send(200, {'status': 'stopping'})
                    threading.Thread(target=self.server.shutdown, daemon=True).start()
                    return
                if route == '/api/rules':
                    return self.send(200, store.save_rule(data))
                if route == '/api/task/run':
                    if (not isinstance(data, dict)
                            or set(data) != {'document_id', 'rule_id', 'local_authorized'}
                            or data['local_authorized'] is not True):
                        raise InputError('请明确勾选仅授权本次本机检查。')
                    result = store.run_task(data['document_id'], data['rule_id'])
                    result['report_url'] = '/reports/' + result['report_id']
                    return self.send(200, result)
                if route in ('/api/run', '/bridge/run'):
                    if not isinstance(data, dict) or set(data) != {'document_id', 'rule_id'}:
                        raise InputError('仅接受文档编号和规则编号。')
                    result = store.run(data['document_id'], data['rule_id'], bridge)
                    result['report_url'] = self.origin + '/reports/' + result['report_id']
                    return self.send(200, result)
                return self.send(404, {'error': '没有此入口。'})
            except InputError as exc:
                return self.send(400, {'error': str(exc)})
            except (ValueError, TypeError, OSError, KeyError, zipfile.BadZipFile):
                return self.send(400, {'error': '处理失败，请核对文件或规则。'})

    # Imported here for the handler error boundary, without loading optional dependencies.
    import zipfile
    server = WorkbenchServer(('127.0.0.1', port), Handler)
    server.store = store
    server.bridge = dict(base_url=f'http://127.0.0.1:{server.server_port}', token=secret, pid=os.getpid())
    return server


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--home', required=True)
    parser.add_argument('--port', type=int, default=0)
    parser.add_argument('--open', action='store_true')
    args = parser.parse_args()
    home = Path(args.home).resolve()
    home.mkdir(parents=True, exist_ok=True, mode=0o700)
    lock = home / 'server.lock'
    try:
        fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        parser.exit(2, '本目录已有运行锁。请先关闭既有服务；若异常退出，确认无服务运行后再人工移除 server.lock。\n')
    with os.fdopen(fd, 'w', encoding='utf-8') as owner:
        json.dump({'pid': os.getpid()}, owner)
        owner.flush()
        os.fsync(owner.fileno())
    server = None
    bridge_path = home / 'bridge.json'
    try:
        server = create_server(home, args.port)
        # This file is a local credential, never packaged or sent to the model.
        fd = os.open(bridge_path, os.O_CREAT | os.O_TRUNC | os.O_WRONLY, 0o600)
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            json.dump(server.bridge, f)
        print(json.dumps({'url': server.bridge['base_url'], 'bridge_path': str(bridge_path)}, ensure_ascii=False), flush=True)
        if args.open:
            import webbrowser
            webbrowser.open(server.bridge['base_url'])
        def stop(*_):
            raise KeyboardInterrupt
        signal.signal(signal.SIGTERM, stop)
        server.serve_forever(poll_interval=0.2)
    except KeyboardInterrupt:
        pass
    finally:
        if server:
            server.server_close()
        bridge_path.unlink(missing_ok=True)
        lock.unlink(missing_ok=True)


if __name__ == '__main__':
    main()
