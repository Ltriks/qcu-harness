"""Opt-in, pinned static downloads. No archive parsing or filesystem HTTP API."""
import hashlib
import json
import os
from pathlib import Path
import re
import stat

CHUNK = 64 * 1024
MANIFEST_LIMIT = 16 * 1024
MAX_TOTAL = 1024 * 1024 * 1024
LIMITS = {'zip': 512 * 1024 * 1024, 'tgz': 32 * 1024 * 1024,
          'html': 1024 * 1024, 'md': 1024 * 1024, 'txt': 1024 * 1024}
TYPES = {'zip': 'application/zip', 'tgz': 'application/gzip',
         'html': 'text/html; charset=utf-8', 'md': 'text/markdown; charset=utf-8',
         'txt': 'text/plain; charset=utf-8'}
NAME = re.compile(r'downloads/[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.(zip|tgz|html|md|txt)', re.ASCII)
HASH = re.compile(r'[a-fA-F0-9]{64}', re.ASCII)
CSP = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; sandbox"


def need(condition):
    if not condition:
        raise ValueError('distribution.invalid')


def fingerprint(info):
    return (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns)


def safe_permissions(info, *, ancestor=False):
    mode = stat.S_IMODE(info.st_mode)
    need(info.st_uid in (0, os.getuid()) and not mode & 0o6000)
    # Root-owned sticky temp ancestors are safe with no-follow traversal. The
    # distribution root and its contents must never be writable by others.
    sticky_temp = ancestor and info.st_uid == 0 and bool(mode & stat.S_ISVTX)
    need(not mode & 0o022 or sticky_temp)


def directory(path):
    need(path.is_absolute() and '..' not in path.parts)
    fd = os.open('/', os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC)
    try:
        safe_permissions(os.fstat(fd), ancestor=bool(path.parts[1:]))
        for index, part in enumerate(path.parts[1:]):
            new = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=fd)
            os.close(fd)
            fd = new
            safe_permissions(os.fstat(fd), ancestor=index < len(path.parts) - 2)
        return fd
    except BaseException:
        os.close(fd)
        raise


def regular(parent, name):
    fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC, dir_fd=parent)
    try:
        info = os.fstat(fd)
        need(stat.S_ISREG(info.st_mode) and info.st_nlink == 1)
        safe_permissions(info)
        need(not stat.S_IMODE(info.st_mode) & 0o111)
        return fd
    except BaseException:
        os.close(fd)
        raise


def pairs(rows):
    result = {}
    for key, value in rows:
        need(key not in result)
        result[key] = value
    return result


def invalid_constant(_):
    raise ValueError('distribution.invalid')


class Distribution:
    def __init__(self, root, manifest_pin):
        self.root, self.files = Path(root), {}
        try:
            need(isinstance(manifest_pin, str) and HASH.fullmatch(manifest_pin))
            parent = directory(self.root)
            try:
                fd = regular(parent, 'manifest.json')
                try:
                    before = fingerprint(os.fstat(fd))
                    need(before[2] <= MANIFEST_LIMIT)
                    raw = os.read(fd, MANIFEST_LIMIT + 1)
                    need(len(raw) == before[2] and fingerprint(os.fstat(fd)) == before)
                finally:
                    os.close(fd)
            finally:
                os.close(parent)
            need(hashlib.sha256(raw).hexdigest() == manifest_pin.lower())
            manifest = json.loads(raw.decode('utf-8'), object_pairs_hook=pairs, parse_constant=invalid_constant)
            need(type(manifest) is dict and set(manifest) == {'schemaVersion', 'files'})
            need(type(manifest['schemaVersion']) is int and manifest['schemaVersion'] == 1)
            need(type(manifest['files']) is dict and len(manifest['files']) <= 8)
            total = 0
            for name, expected in manifest['files'].items():
                match = NAME.fullmatch(name)
                need(match is not None)
                need(type(expected) is dict and set(expected) == {'bytes', 'sha256'})
                size, digest = expected['bytes'], expected['sha256']
                need(type(size) is int and 0 <= size <= LIMITS[match[1]])
                need(type(digest) is str and HASH.fullmatch(digest))
                total += size
                need(total <= MAX_TOTAL)
                self.files['/' + name] = {'bytes': size, 'sha256': digest.lower(), 'extension': match[1]}
            for path, entry in self.files.items():
                fd = self.open_file(path)
                try:
                    before = fingerprint(os.fstat(fd))
                    need(before[2] == entry['bytes'])
                    digest, remaining = hashlib.sha256(), entry['bytes']
                    while remaining:
                        block = os.read(fd, min(CHUNK, remaining))
                        need(block)
                        digest.update(block)
                        remaining -= len(block)
                    need(not os.read(fd, 1) and digest.hexdigest() == entry['sha256'])
                    need(fingerprint(os.fstat(fd)) == before)
                    entry['fingerprint'] = before
                finally:
                    os.close(fd)
        except (OSError, ValueError, TypeError, KeyError, RecursionError):
            # Neither operator errors nor HTTP errors disclose private paths.
            raise ValueError('distribution.invalid') from None

    def open_file(self, path):
        parent = directory(self.root)
        try:
            downloads = os.open('downloads', os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=parent)
            try:
                safe_permissions(os.fstat(downloads))
                return regular(downloads, path.removeprefix('/downloads/'))
            finally:
                os.close(downloads)
        finally:
            os.close(parent)

    @staticmethod
    def byte_range(values, size):
        need(len(values) == 1 and len(values[0]) <= 100)
        match = re.fullmatch(r'bytes=([0-9]*)-([0-9]*)', values[0], re.ASCII)
        need(match is not None and any(match.groups()) and size > 0)
        first, last = match.groups()
        if not first:
            need(int(last) > 0)
            return max(0, size - int(last)), size - 1
        start, end = int(first), int(last) if last else size - 1
        need(start < size and start <= end)
        return start, min(end, size - 1)

    def respond(self, handler, head):
        entry = self.files.get(handler.path)
        if entry is None:
            return False
        # BaseHTTPRequestHandler normalizes an initial double slash. Require
        # the original request target, without decoding or normalization.
        if handler.requestline.split()[1] != handler.path:
            handler.send_error(404)
            return True
        try:
            fd = self.open_file(handler.path)
            try:
                need(fingerprint(os.fstat(fd)) == entry['fingerprint'])
            except BaseException:
                os.close(fd)
                raise
        except (OSError, ValueError):
            handler.send_error(404)
            return True
        try:
            size, etag = entry['bytes'], '"sha256-' + entry['sha256'] + '"'
            start, end, status = 0, size - 1, 200
            ranges = handler.headers.get_all('Range')
            if ranges:
                try:
                    start, end = self.byte_range(ranges, size)
                except ValueError:
                    handler.send_response(416)
                    handler.send_header('Content-Range', 'bytes */%s' % size)
                    handler.send_header('Content-Length', '0')
                    handler.send_header('X-Content-Type-Options', 'nosniff')
                    handler.end_headers()
                    return True
                if handler.headers.get('If-Range', etag) == etag:
                    status = 206
                else:
                    start, end = 0, size - 1
            handler.send_response(status)
            handler.send_header('Content-Type', TYPES[entry['extension']])
            handler.send_header('Content-Length', str(end - start + 1))
            handler.send_header('X-Content-Type-Options', 'nosniff')
            handler.send_header('Referrer-Policy', 'no-referrer')
            handler.send_header('Cache-Control', 'no-store')
            handler.send_header('Accept-Ranges', 'bytes')
            handler.send_header('ETag', etag)
            if status == 206:
                handler.send_header('Content-Range', 'bytes %s-%s/%s' % (start, end, size))
            if entry['extension'] == 'html':
                handler.send_header('Content-Security-Policy', CSP)
            handler.end_headers()
            if not head:
                os.lseek(fd, start, os.SEEK_SET)
                remaining = end - start + 1
                while remaining:
                    block = os.read(fd, min(CHUNK, remaining))
                    if not block:
                        handler.close_connection = True
                        break
                    handler.wfile.write(block)
                    remaining -= len(block)
            return True
        finally:
            os.close(fd)
