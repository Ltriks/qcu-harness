"""QCU cloud incident inbox (loopback backend, authenticated reverse-proxy viewer). Fixed technical fields; no credentials or task text."""
import argparse
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import re
import socket
import sqlite3
import threading
import time
from html import escape
from urllib.parse import parse_qs, urlencode
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

FIELDS = set('schemaVersion incidentId createdAt errorCode stage buildId suiteVersion runtimeVersion platform arch osMajor uploadState fingerprint sourceKind'.split())
CODES = {'QCU-ST-' + n for n in ('1001','1002','1003','1101','1102','1103','1201','1202','1203','1204','1301','1302','1303','1399')}
STAGES = set('arguments release runtime parser data-path seed receipt profile prepare launch migration'.split())
UUID = re.compile(r'^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$')

VIEW_FIELDS = 'incidentId receivedAt schemaVersion createdAt errorCode stage buildId suiteVersion runtimeVersion platform arch osMajor uploadState fingerprint sourceKind'.split()
FILTERS = ('incidentId', 'errorCode', 'suiteVersion', 'stage', 'dateFrom', 'dateTo')
ERRORS = {
    'incident.denied': '访问被拒绝：请通过维护登录入口访问，不接受跨站请求。',
    'incident.invalid': '查询参数无效：请检查故障编号、日期和分页参数后重试。',
    'incident.missing': '未找到该故障记录或页面。请返回列表检查故障编号。',
    'incident.unavailable': '故障记录暂时无法读取，请稍后重试。',
}

def viewer_query(query):
    values = parse_qs(query, keep_blank_values=True, strict_parsing=False, max_num_fields=20)
    if set(values) - set(FILTERS + ('page', 'pageSize')) or any(len(v) != 1 for v in values.values()):
        raise ValueError('query')
    result = {k: v[0] for k, v in values.items() if v[0] != ''}
    for key, default, maximum in (('page', 1, 1000000000), ('pageSize', 20, 100)):
        value = result.get(key, str(default))
        if not re.fullmatch(r'[1-9][0-9]{0,9}', value) or int(value) > maximum:
            raise ValueError('pagination')
        result[key] = int(value)
    if 'incidentId' in result and not UUID.fullmatch(result['incidentId']): raise ValueError('id')
    for key in ('errorCode', 'stage', 'suiteVersion'):
        if key in result and (len(result[key]) > 100 or any(ord(c) < 32 for c in result[key])):
            raise ValueError('filter')
    for key in ('dateFrom', 'dateTo'):
        if key in result:
            if not re.fullmatch(r'[0-9]{4}-[0-9]{2}-[0-9]{2}', result[key]): raise ValueError('date')
            datetime.strptime(result[key], '%Y-%m-%d')
    if result.get('dateFrom', '') > result.get('dateTo', '9999-12-31'): raise ValueError('range')
    return result

COPY_SCRIPT = """document.getElementById('copy-id').addEventListener('click', async () => {
const input = document.getElementById('incident-id');
const status = document.getElementById('copy-status');
input.focus(); input.select(); input.setSelectionRange(0, input.value.length);
try { if (!navigator.clipboard) throw new Error();
await navigator.clipboard.writeText(input.value); status.textContent = '故障编号已复制'; }
catch (_) { status.textContent = '已选中故障编号，请按 Ctrl+C（Mac 为 ⌘C）复制，或长按复制。'; }
});"""

def viewer_page(title, body):
    return ('<!doctype html><html lang="zh-CN"><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width, initial-scale=1">'
            '<title>' + escape(title) + ' · QCU 故障维护</title><style>' + '''
*{box-sizing:border-box}body{margin:0;background:#f5f6f8;color:#182c3c;font:16px/1.6 system-ui,sans-serif}
main{max-width:1200px;margin:auto;padding:32px 24px}h1{font-size:28px;margin:0 0 12px}h2{font-size:20px}
a{color:#075a9c;text-underline-offset:3px}a:hover{color:#003457}p{max-width:75ch}.boundary,.hint{color:#42576a}
form{display:flex;flex-wrap:wrap;gap:16px;align-items:end;margin:28px 0;background:white;padding:20px;border:1px solid #c9d3dc}
label{display:flex;flex-direction:column;gap:4px;font-size:14px}input,select,button{font:inherit;min-height:44px;border:1px solid #75899b;border-radius:4px;padding:8px;background:white;color:inherit}
input{max-width:100%;width:210px}input[name=incidentId]{width:350px}button{cursor:pointer;background:#075a9c;color:white;border-color:#075a9c}button:hover{background:#003f70}
:focus-visible{outline:3px solid #b46b00;outline-offset:3px}::selection{background:#c8e5ff;color:#182c3c}input{caret-color:#075a9c}
.table-wrap{overflow-x:auto;background:white}table{width:100%;border-collapse:collapse;font-size:14px;text-align:left}caption{text-align:left;padding:12px 0;font-size:16px}
th,td{padding:14px 12px;border-bottom:1px solid #c9d3dc;vertical-align:top}th{background:#e9eef3}time,.mono{font-family:ui-monospace,monospace;font-variant-numeric:tabular-nums}.mono{overflow-wrap:anywhere}
nav{display:flex;gap:24px;flex-wrap:wrap;align-items:center;margin:24px 0}.empty{padding:40px 16px;background:white;text-align:center}
dl{display:grid;grid-template-columns:minmax(150px,220px) minmax(0,1fr);background:white;margin:24px 0}dt,dd{padding:12px 16px;border-bottom:1px solid #c9d3dc;margin:0;overflow-wrap:anywhere}dt{font-weight:600}
.copy{display:flex;flex-wrap:wrap;gap:12px;align-items:end}.copy input{width:390px}.error{padding:20px;background:#fff2e5;color:#713b0c}
@media(max-width:600px){main{padding:20px 16px}form,label,form input,form select{width:100%}form{padding:16px}dl{grid-template-columns:minmax(110px,40%) minmax(0,1fr)}dt,dd{padding:10px}h1{font-size:24px}}
''' + '</style><main><h1>' + escape(title) + '</h1>'
            '<p class="boundary">仅限授权内网维护，只读查看。继续拒绝带 Origin 的请求；无 CORS，不对公网开放。'
            '不提供数据库下载、文件读取或批量导出。</p>' + body + '</main></html>')

def viewer_list(result, query):
    controls = []
    for key, label in (('incidentId','故障编号（精确匹配）'), ('errorCode','错误码'), ('suiteVersion','套件版本'),
                       ('stage','阶段'), ('dateFrom','起始日期（UTC，含当天）'), ('dateTo','截止日期（UTC，含当天）')):
        kind = 'date' if key.startswith('date') else 'text'
        controls.append('<label>' + label + '<input type="' + kind + '" name="' + key + '" value="' + escape(str(query.get(key, '')), quote=True) + '"></label>')
    size = query['pageSize']
    form = '<form method="get" action="/maintainer">' + ''.join(controls) + '<label>每页条数<input type="number" name="pageSize" min="1" max="100" value="' + str(size) + '"></label><button type="submit">筛选记录</button><a href="/maintainer">重置筛选</a></form>'
    body = form + '<p role="status">匹配总数：' + str(result['total']) + '；本页条数：' + str(len(result['items'])) + '。按上报时间倒序排列。</p>'
    if not result['items']:
        body += '<p class="empty">暂无符合条件的故障记录</p>'
    else:
        body += '<div class="table-wrap"><table><caption>故障记录（上报时间为 UTC）</caption><thead><tr>' + ''.join('<th scope="col">' + x + '</th>' for x in ('故障编号 / 详情','上报时间','错误码','套件版本','阶段')) + '</tr></thead><tbody>'
        for item in result['items']:
            key = escape(item['incidentId'], quote=True)
            body += '<tr><td class="mono"><a href="/maintainer/incidents/' + key + '">' + key + '</a></td><td><time>' + escape(item['receivedAt']) + '</time></td>'
            body += ''.join('<td>' + escape(str(item.get(k, ''))) + '</td>' for k in ('errorCode','suiteVersion','stage')) + '</tr>'
        body += '</tbody></table></div>'
    page = result['page']
    pages = max(1, (result['total'] + size - 1) // size)
    body += '<nav aria-label="分页"><span>第 ' + str(page) + ' 页，共 ' + str(pages) + ' 页</span>'
    links = []
    if page > 1: links.append(('上一页', page - 1))
    if page * size < result['total']: links.append(('下一页', page + 1))
    if page > pages: links.append(('返回第一页', 1))
    for label, number in links:
        body += '<a href="/maintainer?' + escape(urlencode(dict(query, page=number)), quote=True) + '">' + label + '</a>'
    return viewer_page('故障记录', body + '</nav>')

def viewer_detail(item):
    body = '<p><a href="/maintainer">返回故障列表</a></p><div class="copy"><label>故障编号<input id="incident-id" readonly value="' + escape(item['incidentId'], quote=True) + '"></label><button id="copy-id" type="button">复制故障编号</button></div><p id="copy-status" role="status" class="hint">可直接选中编号复制；内网 HTTP 不支持剪贴板时将提示手动复制。</p><h2>固定技术字段</h2><dl>'
    body += ''.join('<dt>' + key + '</dt><dd class="mono">' + escape(str(item.get(key, ''))) + '</dd>' for key in VIEW_FIELDS)
    return viewer_page('故障详情', body + '</dl><script>' + COPY_SCRIPT + '</script>')

def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=True, separators=(',', ':'), allow_nan=False)

def validate(value):
    if type(value) is not dict or set(value) != FIELDS:
        raise ValueError('schema')
    def need(ok):
        if not ok: raise ValueError('invalid')
    need(type(value['schemaVersion']) is int and value['schemaVersion'] == 1)
    need(type(value['incidentId']) is str and bool(UUID.fullmatch(value['incidentId'])))
    need(type(value['createdAt']) is str and bool(re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z', value['createdAt'])))
    stamp = datetime.fromisoformat(value['createdAt'].replace('Z', '+00:00')).timestamp()
    need(time.time()-30*86400 <= stamp <= time.time()+300)
    need(value['errorCode'] in CODES and value['stage'] in STAGES)
    need(value['buildId'] in ('rc43-maintenance.2','rc44.1','rc44.2','rc45.1'))
    need(value['suiteVersion'] in ('0.1.0-rc.4.1', '0.1.0-rc.4.2', '0.1.0-rc.4.3', '0.1.0-rc.4.4', '0.1.0-rc.4.5', 'unobserved'))
    need(type(value['runtimeVersion']) is str and bool(re.fullmatch(r'v\d{1,3}\.\d{1,3}\.\d{1,3}', value['runtimeVersion'])))
    need(value['platform'] in ('darwin','win32','linux','other') and value['arch'] in ('arm64','x64','other'))
    need(type(value['osMajor']) is str and bool(re.fullmatch(r'\d{1,4}', value['osMajor'])))
    need(value['uploadState'] == 'local-only' and value['sourceKind'] in ('startup', 'self-test'))
    fingerprint_input = json.dumps([1, value['errorCode'], value['stage'], value['buildId'], value['suiteVersion']], separators=(',', ':'))
    need(value['fingerprint'] == hashlib.sha256(fingerprint_input.encode()).hexdigest())
    return value

def parse(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result: raise ValueError('duplicate')
            result[key] = value
        return result
    return validate(json.loads(raw.decode('utf-8'), object_pairs_hook=pairs, parse_constant=lambda _: (_ for _ in ()).throw(ValueError('number'))))

class Store:
    def __init__(self, root):
        self.root = Path(root)
        if not self.root.is_absolute(): raise ValueError('absolute root required')
        for p in (self.root, *self.root.parents):
            if p.is_symlink(): raise ValueError('unsafe root')
        self.root.mkdir(mode=0o700, parents=True, exist_ok=True)
        if self.root.stat().st_uid != os.getuid() or self.root.stat().st_mode & 0o777 != 0o700:
            raise ValueError('private root required')
        self.path = self.root / 'incidents.sqlite3'
        if self.path.exists():
            stat = self.path.lstat()
            if self.path.is_symlink() or not self.path.is_file() or stat.st_nlink != 1 or stat.st_uid != os.getuid() or stat.st_mode & 0o777 != 0o600:
                raise ValueError('unsafe database')
        os.umask(0o077)
        with self.connect() as conn:
            conn.execute('CREATE TABLE IF NOT EXISTS incidents (id TEXT PRIMARY KEY, digest TEXT NOT NULL, payload TEXT NOT NULL, received TEXT NOT NULL, fingerprint TEXT NOT NULL)')
        os.chmod(self.path, 0o600)

    def connect(self):
        return sqlite3.connect(self.path, timeout=2)

    def receipt(self, key, received):
        return {'incidentId': key, 'receiptId': hashlib.sha256(('QCU-INCIDENT/V1:'+key).encode()).hexdigest(), 'state': 'received', 'receivedAt': received}

    def receive(self, value):
        payload = canonical(value)
        digest = hashlib.sha256(payload.encode()).hexdigest()
        with self.connect() as conn:
            conn.execute('BEGIN IMMEDIATE')
            row = conn.execute('SELECT digest, received FROM incidents WHERE id=?', (value['incidentId'],)).fetchone()
            if row:
                if row[0] != digest: return 409, {'error': 'incident.conflict'}
                return 200, self.receipt(value['incidentId'], row[1])
            if conn.execute('SELECT count(*) FROM incidents').fetchone()[0] >= 10000:
                return 503, {'error': 'incident.full'}
            since = datetime.fromtimestamp(time.time()-86400, timezone.utc).isoformat()
            if conn.execute('SELECT count(*) FROM incidents WHERE fingerprint=? AND received>?', (value['fingerprint'],since)).fetchone()[0] >= 5:
                return 429, {'error': 'incident.rate'}
            received = datetime.now(timezone.utc).isoformat()
            conn.execute('INSERT INTO incidents VALUES (?,?,?,?,?)', (value['incidentId'],digest,payload,received,value['fingerprint']))
            return 201, self.receipt(value['incidentId'], received)

    def lookup(self, key):
        with self.connect() as conn:
            row = conn.execute('SELECT received FROM incidents WHERE id=?', (key,)).fetchone()
        return (200,self.receipt(key,row[0])) if row else (404,{'error':'incident.missing'})

    def read_connection(self):
        # A separate read-only connection; maintenance queries cannot mutate the inbox.
        conn = sqlite3.connect(self.path.as_uri() + '?mode=ro', uri=True, timeout=2)
        conn.execute('PRAGMA query_only=ON')
        return conn

    def view_item(self, row):
        payload = json.loads(row[1])
        item = {key: payload[key] for key in VIEW_FIELDS if key in FIELDS and key in payload}
        item.update(incidentId=row[0], receivedAt=row[2])
        return item

    def list_incidents(self, query):
        clauses, params = [], []
        for key in ('incidentId', 'errorCode', 'suiteVersion', 'stage'):
            if key in query:
                column = 'id' if key == 'incidentId' else "json_extract(payload, '$." + key + "')"
                clauses.append(column + ' = ?')
                params.append(query[key])
        # Stored received timestamps are server-generated UTC ISO strings.
        for key, operator in (('dateFrom', '>='), ('dateTo', '<=')):
            if key in query:
                clauses.append('substr(received, 1, 10) ' + operator + ' ?')
                params.append(query[key])
        where = ' WHERE ' + ' AND '.join(clauses) if clauses else ''
        conn = self.read_connection()
        try:
            conn.execute('BEGIN')  # Count and page share one snapshot during concurrent POSTs.
            total = conn.execute('SELECT count(*) FROM incidents' + where, params).fetchone()[0]
            rows = conn.execute('SELECT id, payload, received FROM incidents' + where +
                                ' ORDER BY received DESC, id DESC LIMIT ? OFFSET ?',
                                params + [query['pageSize'], (query['page'] - 1) * query['pageSize']]).fetchall()
            return {'items': [self.view_item(row) for row in rows], 'total': total,
                    'page': query['page'], 'pageSize': query['pageSize']}
        finally:
            conn.close()

    def incident_detail(self, key):
        conn = self.read_connection()
        try:
            row = conn.execute('SELECT id, payload, received FROM incidents WHERE id=?', (key,)).fetchone()
            return self.view_item(row) if row else None
        finally:
            conn.close()

class Server(ThreadingHTTPServer):
    daemon_threads = True
    def __init__(self, address, store, network):
        self.store, self.network = store, ipaddress.ip_network(network)
        self.slots = threading.BoundedSemaphore(8)
        self.rate_lock, self.rates = threading.Lock(), {}
        super().__init__(address, Handler)
    def process_request(self, request, address):
        if not self.slots.acquire(blocking=False): request.close(); return
        try: super().process_request(request, address)
        except BaseException: self.slots.release(); raise
    def process_request_thread(self, request, address):
        try: super().process_request_thread(request, address)
        finally: self.slots.release()
    def handle_error(self, request, address):
        pass  # Never emit raw request paths or payloads.
    def allowed(self, address):
        if ipaddress.ip_address(address) not in self.network: return False
        tick = int(time.time()//60)
        with self.rate_lock:
            self.rates = {k:v for k,v in self.rates.items() if v[0] == tick}
            window, count = self.rates.get(address, (tick,0))
            self.rates[address] = (window,count+1)
            return count < 60

class Handler(BaseHTTPRequestHandler):
    server_version = 'QCU-Incidents/1'
    sys_version = ''
    def log_message(self, *args): pass
    def setup(self):
        super().setup(); self.connection.settimeout(5)
    def reply(self, status, value):
        data = canonical(value).encode()
        self.send_response(status)
        for k,v in [('Content-Type','application/json'),('Content-Length',str(len(data))),('Cache-Control','no-store'),('X-Content-Type-Options','nosniff')]: self.send_header(k,v)
        if status == 429: self.send_header('Retry-After','3600')
        self.end_headers(); self.wfile.write(data)
    def html_reply(self, status, page):
        import base64
        script_hash = base64.b64encode(hashlib.sha256(COPY_SCRIPT.encode()).digest()).decode()
        data = page.encode('utf-8')
        self.send_response(status)
        for key, value in [('Content-Type','text/html; charset=utf-8'), ('Content-Length',str(len(data))),
                           ('Cache-Control','no-store'), ('X-Content-Type-Options','nosniff'),
                           ('Referrer-Policy','no-referrer'), ('X-Frame-Options','DENY'),
                           ('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'sha256-" + script_hash + "'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'")]:
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(data)

    def viewer_error(self, status, code, html):
        message = ERRORS[code]
        if html:
            self.html_reply(status, viewer_page('无法查看故障记录', '<p role="alert" class="error">' + message + '</p><p><a href="/maintainer">返回故障列表</a></p>'))
        else:
            self.reply(status, {'error': code, 'message': message})

    def guard(self, html=False):
        # No CORS or browser-origin submissions. No generic file/read API.
        if not self.server.allowed(self.client_address[0]) or self.headers.get('Origin') is not None:
            if html: self.viewer_error(403, 'incident.denied', True)
            else: self.reply(403,{'error':'incident.denied'})
            return False
        return True
    def do_GET(self):
        path, _, query = self.path.partition('?')
        html = path == '/maintainer' or path.startswith('/maintainer/')
        if not self.guard(html): return
        if html or path == '/v1/maintainer/incidents' or path.startswith('/v1/maintainer/incidents/'):
            self.maintainer_get(path, query, html); return
        if self.path == '/health': self.reply(200,{'ok':True,'service':'qcu-incidents','schemaVersion':1}); return
        match = re.fullmatch(r'/v1/incidents/([a-f0-9-]{36})/receipt', self.path)
        if match and UUID.fullmatch(match[1]):
            self.reply(*self.server.store.lookup(match[1])); return
        self.reply(404,{'error':'incident.missing'})

    def maintainer_get(self, path, query, html):
        list_path = '/maintainer' if html else '/v1/maintainer/incidents'
        detail_prefix = '/maintainer/incidents/' if html else '/v1/maintainer/incidents/'
        try:
            if path == list_path:
                params = viewer_query(query)
                result = self.server.store.list_incidents(params)
                if html: self.html_reply(200, viewer_list(result, params))
                else: self.reply(200, result)
                return
            if not path.startswith(detail_prefix):
                self.viewer_error(404, 'incident.missing', html); return
            key = path[len(detail_prefix):]
            if not UUID.fullmatch(key) or query:
                self.viewer_error(400, 'incident.invalid', html); return
            item = self.server.store.incident_detail(key)
            if item is None:
                self.viewer_error(404, 'incident.missing', html); return
            if html: self.html_reply(200, viewer_detail(item))
            else: self.reply(200, item)
        except (ValueError, TypeError, KeyError):
            self.viewer_error(400, 'incident.invalid', html)
        except sqlite3.Error:
            self.viewer_error(503, 'incident.unavailable', html)
    def do_POST(self):
        if not self.guard(): return
        if self.path != '/v1/incidents': self.reply(404,{'error':'incident.missing'}); return
        if self.headers.get('Content-Type') != 'application/json' or self.headers.get('Transfer-Encoding'):
            self.reply(415,{'error':'incident.format'}); return
        length = self.headers.get_all('Content-Length') or []
        if len(length)!=1 or not re.fullmatch(r'[1-9][0-9]{0,4}',length[0]) or int(length[0])>16384:
            self.reply(413,{'error':'incident.size'}); return
        try:
            raw=self.rfile.read(int(length[0]))
            if len(raw)!=int(length[0]): raise ValueError('short')
            value=parse(raw)
        except (ValueError,TypeError,KeyError,RecursionError,UnicodeError,socket.timeout):
            self.reply(400,{'error':'incident.invalid'}); return
        try: self.reply(*self.server.store.receive(value))
        except sqlite3.Error: self.reply(503,{'error':'incident.unavailable'})

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=18768)
    parser.add_argument('--root', required=True)
    parser.add_argument('--network', default='127.0.0.0/8')
    args=parser.parse_args()
    if ipaddress.ip_address(args.host) not in ipaddress.ip_network(args.network): parser.error('listen host must be in permitted network')
    server=Server((args.host,args.port),Store(args.root),args.network)
    print(json.dumps({'service':'qcu-incidents','host':args.host,'port':server.server_port}),flush=True)
    server.serve_forever()
