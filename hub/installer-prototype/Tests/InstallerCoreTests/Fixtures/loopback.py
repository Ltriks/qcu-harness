"""Test-only GET file fixture. Binds ephemeral 127.0.0.1, no control/write API."""
import http.server
import json
import pathlib
import sys
import time
import urllib.parse

root = pathlib.Path(sys.argv[1]).resolve()


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_GET(self):
        path = urllib.parse.urlsplit(self.path).path
        with (root / 'requests.txt').open('a') as f:
            f.write(path + '\n')
        target = (root / path.lstrip('/')).resolve()
        if root not in target.parents or not target.is_file():
            self.send_error(404)
            return
        mode = json.loads((root / 'mode.json').read_text()) if path.startswith('/packages/') else 'ok'
        if mode in ('redirect', 'cross-redirect'):
            self.send_response(302)
            host = 'localhost' if mode == 'cross-redirect' else '127.0.0.1'
            self.send_header('Location', 'http://%s:%d/redirect-target' % (host, self.server.server_port))
            self.end_headers()
            return
        if mode == 'unauthorized':
            self.send_response(401)
            self.send_header('WWW-Authenticate', 'Basic realm="test"')
            self.end_headers()
            return
        data = target.read_bytes()
        if mode == 'bad-hash':
            data = bytes([data[0] ^ 1]) + data[1:]
        if mode == 'truncated':
            data = data[:-8]
        self.send_response(200)
        if mode == 'oversize':
            self.send_header('Content-Length', str(9 * 1024 * 1024))
        elif mode != 'unbounded':
            self.send_header('Content-Length', str(target.stat().st_size))
        self.end_headers()
        try:
            if mode == 'slow':
                self.wfile.write(data[:1])
                self.wfile.flush()
                time.sleep(3)
                self.wfile.write(data[1:])
            else:
                self.wfile.write(data + (b'A' * 16384 if mode == 'unbounded' else b''))
        except (BrokenPipeError, ConnectionResetError):
            pass


server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
server.daemon_threads = True
print(server.server_port, flush=True)
server.serve_forever()
