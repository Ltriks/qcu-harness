"""Private parent-pipe lifetime and conservative ownership-file cleanup."""
import os
import stat
import threading


class ParentStdinLifetime:
    """EOF is loss of the owning Host, never a command or a recorded PID."""
    GRACE_SECONDS = 2.0
    CLEANUP_SECONDS = 1.0

    def __init__(self, cleanup):
        self.lost = threading.Event()
        self.finished = threading.Event()
        self.serving = threading.Event()
        self.server = None
        self.cleanup = cleanup
        threading.Thread(target=self._watch, daemon=True).start()

    def _watch(self):
        try:
            # Do not use buffered stdin: its I/O lock can stall interpreter exit.
            while os.read(0, 4096):
                pass  # Unexpected bytes carry no commands and are never logged.
        except OSError:
            pass  # An unusable lifetime channel fails closed, just like EOF.
        self.lost.set()
        threading.Thread(target=self._bound_exit, daemon=True).start()
        # shutdown() blocks before serve_forever starts. Never call it on main,
        # and never join this daemon when startup exits without serving.
        self.serving.wait()
        self.server.shutdown()

    def serve(self, server):
        self.server = server
        if self.lost.is_set():
            return
        self.serving.set()
        server.serve_forever(poll_interval=0.2)

    def _bound_exit(self):
        if self.finished.wait(self.GRACE_SECONDS):
            return
        # A stuck startup/serve loop must not retain a listener indefinitely.
        # Give ownership-aware cleanup one final bounded chance, then exit only
        # this process. Never signal or adopt a PID from an ownership record.
        cleanup = threading.Thread(target=self.cleanup, daemon=True)
        cleanup.start()
        cleanup.join(self.CLEANUP_SECONDS)
        os._exit(0)


class OwnedServiceFiles:
    """Only remove the unchanged private files created by this invocation."""
    def __init__(self, home):
        self.lock_path = home / 'server.lock'
        self.bridge_path = home / 'bridge.json'
        self.records = {}
        self.mutex = threading.Lock()

    def create(self, path, data, sync=False):
        with self.mutex:
            # O_EXCL also refuses pre-existing bridges and symbolic links.
            fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            with os.fdopen(fd, 'wb') as handle:
                try:
                    handle.write(data)
                    handle.flush()
                    if sync:
                        os.fsync(handle.fileno())
                finally:
                    self.records[path] = (os.fstat(handle.fileno()), data)
            # Windows can finalize the last-write timestamp only on close.
            # Refresh metadata only while the path still names the created file;
            # cleanup separately verifies its private mode and exact contents.
            current = path.lstat()
            created = self.records[path][0]
            if (current.st_dev, current.st_ino) == (created.st_dev, created.st_ino):
                self.records[path] = (current, data)

    @staticmethod
    def _identity(value):
        return (value.st_dev, value.st_ino, value.st_size,
                value.st_mtime_ns, value.st_ctime_ns, value.st_mode, value.st_uid)

    def _matches(self, path):
        expected = self.records.get(path)
        if expected is None:
            return False
        try:
            if not stat.S_ISREG(path.lstat().st_mode):
                return False
            fd = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0))
            with os.fdopen(fd, 'rb') as handle:
                current = os.fstat(handle.fileno())
                return (stat.S_ISREG(current.st_mode) and current.st_nlink == 1
                        and (os.name == 'nt' or (current.st_mode & 0o077 == 0
                             and current.st_uid == os.getuid()))
                        and self._identity(current) == self._identity(expected[0])
                        and handle.read(4097) == expected[1])
        except OSError:
            return False

    def cleanup(self):
        with self.mutex:
            # Keep both records when either was replaced or became unverified.
            # A missing bridge is allowed if startup had not created one yet.
            if not self._matches(self.lock_path):
                return
            bridge_exists = os.path.lexists(self.bridge_path)
            if bridge_exists and not self._matches(self.bridge_path):
                return
            if not self._matches(self.lock_path):
                return
            if bridge_exists:
                if not self._matches(self.bridge_path):
                    return
                self.bridge_path.unlink()
            self.lock_path.unlink()
