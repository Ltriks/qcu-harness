#!/usr/bin/env python3
"""Behavioral tests. Only synthetic localhost HTTP; never invoke the native UI."""
import argparse
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import plistlib
import re
import signal
import subprocess
import sys
import tempfile
import threading
import unittest

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tools/qcu-market-prepare/prepare-market.sh"
PACKER = ROOT / "scripts/pack-qcu-market-prepare.py"
PIN_SHA = "ecdc4373baad4de8415c27a6b04aa31b9e01ae516a6e3e972660a32bd7108e12"
PIN_URL = f"http://192.168.1.68:8080/plugins/qcu-market-0.1.0-pilot.9.1-{PIN_SHA}.tgz"
PAYLOAD = (b"QCU synthetic bytes only\x00" * 2000)[:43446]
SCRATCH_PARENT = ROOT


class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


@unittest.skipUnless(sys.platform == "darwin", "macOS system runtime required")
class PreparationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="qcu-prepare-test-", dir=SCRATCH_PARENT)
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.destination = self.root / '教师安装包 空格 "引号" \\目录'
        self.requests = []
        self.body = PAYLOAD
        self.status = 200
        self.headers = {}
        self.send_length = True
        self.started = threading.Event()
        self.release = threading.Event()
        self.pause = False
        case = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                case.requests.append((self.path, dict(self.headers)))
                self.send_response(case.status)
                if case.send_length:
                    self.send_header("Content-Length", str(len(case.body)))
                for name, value in case.headers.items():
                    self.send_header(name, value)
                self.end_headers()
                case.started.set()
                try:
                    if case.pause:
                        self.wfile.write(case.body[:1])
                        self.wfile.flush()
                        case.release.wait(10)
                        self.wfile.write(case.body[1:])
                    else:
                        self.wfile.write(case.body)
                except (BrokenPipeError, ConnectionResetError):
                    pass

            def log_message(self, *args):
                pass

        self.server = Server(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.stop_server)
        self.script = self.root / "synthetic-prepare.sh"
        text = SOURCE.read_text()
        # Only exact, single reviewed constant lines may be substituted in a copy.
        for old, new in [
            (f"QCU_SHA256='{PIN_SHA}'", f"QCU_SHA256='{hashlib.sha256(PAYLOAD).hexdigest()}'"),
            (f"QCU_URL='{PIN_URL}'", f"QCU_URL='http://127.0.0.1:{self.server.server_port}/package.tgz'"),
        ]:
            self.assertEqual(text.count(old), 1)
            text = text.replace(old, new)
        self.script.write_text(text)

    def stop_server(self):
        self.release.set()
        if self.server:
            self.server.shutdown()
            self.server.server_close()
            self.thread.join(timeout=3)
            self.server = None

    @property
    def target(self):
        sha = hashlib.sha256(PAYLOAD).hexdigest()
        return self.destination / f"qcu-market-0.1.0-pilot.9.1-{sha}.tgz"

    def command(self, *args, script=None, destination=None):
        return ["/bin/bash", str(script or self.script), *args,
                "--destination-directory", str(destination or self.destination)]

    def run_cli(self, *args, script=None, destination=None, env=None):
        return subprocess.run(self.command(*args, script=script, destination=destination),
                              capture_output=True, text=True, timeout=40, env=env)

    def assert_clean(self):
        if self.destination.is_dir():
            self.assertEqual(list(self.destination.glob(".qcu-partial.*")), [])

    def assert_failure(self, result, code=None):
        self.assertNotEqual(result.returncode, 0, result.stdout)
        report = json.loads(result.stdout)
        self.assertEqual(report["status"], "failed")
        self.assertFalse(report["installed"])
        self.assertFalse(report["enabled"])
        self.assertTrue(report["official_confirmation_required"])
        self.assertNotIn("path", report)
        if code:
            self.assertEqual(report["code"], code, result.stderr)
        self.assert_clean()
        return report

    def existing(self, content=PAYLOAD):
        self.destination.mkdir(mode=0o700)
        self.target.write_bytes(content)
        self.target.chmod(0o600)

    def test_download_json_truthful_and_private(self):
        result = self.run_cli("--json")
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads(result.stdout)
        self.assertEqual(report["status"], "new")
        self.assertEqual(report["tool_version"], "0.1.0-bootstrap.1")
        self.assertEqual(report["market_version"], "0.1.0-pilot.9.1")
        self.assertEqual(report["path"], str(self.target))
        self.assertEqual(report["bytes"], len(PAYLOAD))
        self.assertEqual(report["sha256"], hashlib.sha256(PAYLOAD).hexdigest())
        self.assertFalse(report["installed"])
        self.assertFalse(report["enabled"])
        self.assertTrue(report["official_confirmation_required"])
        self.assertEqual(self.target.read_bytes(), PAYLOAD)
        self.assertEqual(self.target.stat().st_mode & 0o777, 0o600)
        self.assertEqual(self.destination.stat().st_mode & 0o777, 0o700)
        self.assertEqual(len(self.requests), 1)
        self.assertEqual(self.requests[0][0], "/package.tgz")
        request_headers = {k.lower(): v for k, v in self.requests[0][1].items()}
        self.assertEqual(request_headers["accept-encoding"], "identity")
        for header in ("authorization", "proxy-authorization", "cookie"):
            self.assertNotIn(header, request_headers)
        self.assert_clean()

    def test_reuse_without_http_and_inode_unchanged(self):
        self.existing()
        before = self.target.stat()
        self.stop_server()
        result = self.run_cli()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["status"], "reused")
        self.assertEqual(self.target.stat().st_ino, before.st_ino)
        self.assertEqual(self.target.stat().st_mtime_ns, before.st_mtime_ns)
        self.assertEqual(self.requests, [])

    def test_path_only_and_spaces_chinese_quotes(self):
        result = self.run_cli("--path-only")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, str(self.target) + "\n")

    def test_wrong_size(self):
        self.body = PAYLOAD[:-1]
        self.assert_failure(self.run_cli(), "INTEGRITY_FAILED")
        self.assertFalse(self.target.exists())

    def test_wrong_hash(self):
        self.body = b"x" * len(PAYLOAD)
        self.assert_failure(self.run_cli(), "INTEGRITY_FAILED")
        self.assertFalse(self.target.exists())

    def test_status_404(self):
        self.status = 404
        self.assert_failure(self.run_cli(), "DOWNLOAD_FAILED")

    def test_redirect_never_followed(self):
        self.status = 302
        self.headers["Location"] = f"http://127.0.0.1:{self.server.server_port}/must-not-fetch"
        self.assert_failure(self.run_cli(), "DOWNLOAD_FAILED")
        self.assertEqual([p for p, _ in self.requests], ["/package.tgz"])

    def test_oversize_with_length(self):
        self.body = PAYLOAD + b"extra"
        self.assert_failure(self.run_cli(), "DOWNLOAD_FAILED")
        self.assertFalse(self.target.exists())

    def test_oversize_without_length(self):
        self.body = PAYLOAD * 20
        self.send_length = False
        self.assert_failure(self.run_cli(), "DOWNLOAD_FAILED")
        self.assertFalse(self.target.exists())

    def test_no_length_valid_body(self):
        self.send_length = False
        result = self.run_cli()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.target.read_bytes(), PAYLOAD)

    def test_content_encoding_refused(self):
        self.headers["Content-Encoding"] = "gzip"
        self.assert_failure(self.run_cli(), "INTEGRITY_FAILED")

    def test_network_failure_nonzero(self):
        self.stop_server()
        self.assert_failure(self.run_cli(), "DOWNLOAD_FAILED")

    def test_cancel_cleans_only_own_attempt(self):
        self.pause = True
        self.destination.mkdir(mode=0o700)
        old_partial = self.destination / ".qcu-partial-unrelated"
        old_partial.write_text("preserve")
        process = subprocess.Popen(self.command(), stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                   text=True, start_new_session=True)
        try:
            self.assertTrue(self.started.wait(5))
            process.send_signal(signal.SIGTERM)
            stdout, stderr = process.communicate(timeout=5)
            self.assert_failure(subprocess.CompletedProcess([], process.returncode, stdout, stderr), "CANCELLED")
            self.assertEqual(old_partial.read_text(), "preserve")
            self.assertFalse(self.target.exists())
        finally:
            self.release.set()
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGKILL)
                process.communicate()

    def test_bad_existing_size_preserved_without_http(self):
        self.existing(b"bad")
        inode = self.target.stat().st_ino
        self.assert_failure(self.run_cli(), "CACHE_INVALID")
        self.assertEqual(self.target.read_bytes(), b"bad")
        self.assertEqual(self.target.stat().st_ino, inode)
        self.assertEqual(self.requests, [])

    def test_bad_existing_hash_preserved_without_http(self):
        self.existing(b"x" * len(PAYLOAD))
        self.assert_failure(self.run_cli(), "CACHE_INVALID")
        self.assertEqual(self.target.read_bytes(), b"x" * len(PAYLOAD))
        self.assertEqual(self.requests, [])

    def test_existing_directory_preserved(self):
        self.destination.mkdir(mode=0o700)
        self.target.mkdir(mode=0o700)
        self.assert_failure(self.run_cli(), "CACHE_INVALID")
        self.assertEqual(list(self.target.iterdir()), [])
        self.assertEqual(self.requests, [])

    def test_existing_fifo_refused_without_hang(self):
        self.destination.mkdir(mode=0o700)
        os.mkfifo(self.target, mode=0o600)
        self.assert_failure(self.run_cli(), "CACHE_INVALID")
        self.assertTrue(self.target.is_fifo())
        self.assertEqual(self.requests, [])

    def test_symlink_file_preserved(self):
        self.destination.mkdir(mode=0o700)
        other = self.root / "other.tgz"
        other.write_bytes(PAYLOAD)
        self.target.symlink_to(other)
        self.assert_failure(self.run_cli(), "CACHE_INVALID")
        self.assertTrue(self.target.is_symlink())
        self.assertEqual(other.read_bytes(), PAYLOAD)
        self.assertEqual(self.requests, [])

    def test_dangling_symlink_file_preserved(self):
        self.destination.mkdir(mode=0o700)
        self.target.symlink_to(self.root / "missing")
        self.assert_failure(self.run_cli(), "CACHE_INVALID")
        self.assertTrue(self.target.is_symlink())
        self.assertEqual(self.requests, [])

    def test_symlink_destination(self):
        other = self.root / "real-directory"
        other.mkdir(mode=0o700)
        self.destination.symlink_to(other, target_is_directory=True)
        self.assert_failure(self.run_cli(), "UNSAFE_PATH")
        self.assertEqual(list(other.iterdir()), [])
        self.assertEqual(self.requests, [])

    def test_symlink_ancestor(self):
        other = self.root / "real-directory"
        other.mkdir(mode=0o700)
        alias = self.root / "alias"
        alias.symlink_to(other, target_is_directory=True)
        self.assert_failure(self.run_cli(destination=alias / "child"), "UNSAFE_PATH")
        self.assertEqual(list(other.iterdir()), [])
        self.assertEqual(self.requests, [])

    def test_non_directory_ancestor(self):
        ancestor = self.root / "file"
        ancestor.write_text("keep")
        self.assert_failure(self.run_cli(destination=ancestor / "child"), "UNSAFE_PATH")
        self.assertEqual(ancestor.read_text(), "keep")

    def test_writable_ancestor(self):
        ancestor = self.root / "unsafe"
        ancestor.mkdir(mode=0o700)
        ancestor.chmod(0o777)
        self.assert_failure(self.run_cli(destination=ancestor / "child"), "UNSAFE_PATH")
        self.assertEqual(list(ancestor.iterdir()), [])

    def test_nonprivate_destination_unchanged(self):
        self.destination.mkdir(mode=0o755)
        self.destination.chmod(0o755)
        self.assert_failure(self.run_cli(), "UNSAFE_PATH")
        self.assertEqual(self.destination.stat().st_mode & 0o777, 0o755)

    def test_nonprivate_file_unchanged(self):
        self.existing()
        self.target.chmod(0o644)
        self.assert_failure(self.run_cli(), "CACHE_INVALID")
        self.assertEqual(self.target.stat().st_mode & 0o777, 0o644)
        self.assertEqual(self.requests, [])

    def test_acl_shared_directory_refused(self):
        self.destination.mkdir(mode=0o700)
        subprocess.run(["/bin/chmod", "+a", "everyone allow list,search", str(self.destination)], check=True)
        self.assert_failure(self.run_cli(), "UNSAFE_PATH")
        self.assertEqual(self.requests, [])

    def test_acl_shared_file_refused(self):
        self.existing()
        subprocess.run(["/bin/chmod", "+a", "everyone allow read", str(self.target)], check=True)
        self.assert_failure(self.run_cli(), "CACHE_INVALID")
        self.assertEqual(self.target.read_bytes(), PAYLOAD)
        self.assertEqual(self.requests, [])

    def test_root_owned_destination_refused(self):
        self.assert_failure(self.run_cli(destination="/Users"), "UNSAFE_PATH")
        self.assertEqual(self.requests, [])

    def test_invalid_paths_no_network(self):
        for path in ["relative", str(self.root) + "/bad\npath", str(self.root) + "/bad\tpath",
                     str(self.root) + "/../child", str(self.root) + "//child", "/"]:
            with self.subTest(path=repr(path)):
                self.assert_failure(self.run_cli(destination=path), "UNSAFE_PATH")
        self.assertEqual(self.requests, [])

    def test_no_url_hash_version_env_override(self):
        result = self.run_cli("--url", "http://127.0.0.1:1")
        self.assert_failure(result, "USAGE")
        self.assertEqual(self.requests, [])

    def test_inherited_proxy_and_curl_config_ignored(self):
        fake_config = self.root / "synthetic-curl-config"
        fake_config.mkdir()
        (fake_config / ".curlrc").write_text('url = "http://127.0.0.1:1/forbidden"\n')
        env = dict(os.environ, CURL_HOME=str(fake_config), http_proxy="http://127.0.0.1:1",
                   ALL_PROXY="http://127.0.0.1:1", QCU_URL="http://127.0.0.1:1", QCU_BYTES="1")
        result = self.run_cli(env=env)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(self.requests), 1)
        self.assertEqual(self.target.read_bytes(), PAYLOAD)

    def publication_race(self, kind):
        self.pause = True
        process = subprocess.Popen(self.command(), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            self.assertTrue(self.started.wait(5))
            if kind == "file":
                self.target.write_bytes(b"keep race bytes")
            elif kind == "directory":
                self.target.mkdir()
            else:
                other = self.root / "other-directory"
                other.mkdir()
                self.target.symlink_to(other, target_is_directory=True)
            self.release.set()
            stdout, stderr = process.communicate(timeout=10)
            self.assert_failure(subprocess.CompletedProcess([], process.returncode, stdout, stderr), "PUBLICATION_RACE")
            if kind == "file":
                self.assertEqual(self.target.read_bytes(), b"keep race bytes")
            else:
                self.assertEqual(list(self.target.iterdir()), [])
        finally:
            self.release.set()
            if process.poll() is None:
                process.kill()
                process.communicate()

    def test_race_existing_file_not_replaced(self):
        self.publication_race("file")

    def test_race_existing_directory_not_written_inside(self):
        self.publication_race("directory")

    def test_race_symlink_directory_not_written_inside(self):
        self.publication_race("symlink")

    def test_production_constants_and_no_external_runtime_actions(self):
        shell = SOURCE.read_text()
        self.assertIn(f"QCU_URL='{PIN_URL}'", shell)
        self.assertIn(f"QCU_SHA256='{PIN_SHA}'", shell)
        self.assertIn("QCU_BYTES=43446", shell)
        self.assertIn("QCU_SOURCE_COMMIT='bb1e5c80a01f26f1ab147717cbd9f79b57b198e3'", shell)
        for command in ["osascript", "pbcopy", "pnpm", "npm", "node", "python3", "open", "chmod", "xattr"]:
            self.assertIsNone(re.search(rf"^\s*(?:/[^\s]+/)?{command}\s", shell, re.M))
        self.assertNotIn("eval ", shell)


@unittest.skipUnless(sys.platform == "darwin", "macOS build required")
class PackagingTests(unittest.TestCase):
    def test_build_source_pin_checksums_modes_and_refuse_overwrite(self):
        with tempfile.TemporaryDirectory(prefix="qcu-pack-test-", dir=SCRATCH_PARENT) as directory:
            out = Path(directory) / "候选包 with spaces"
            command = [sys.executable, str(PACKER), "--out", str(out)]
            result = subprocess.run(command, text=True, capture_output=True, timeout=60)
            self.assertEqual(result.returncode, 0, result.stderr)
            manifest = json.loads((out / "MANIFEST.json").read_text())
            self.assertFalse(manifest["installed"])
            self.assertFalse(manifest["enabled"])
            self.assertFalse(manifest["build"]["native_ui_tested"])
            self.assertTrue(manifest["build"]["ad_hoc_signed"])
            self.assertTrue(manifest["build"]["signature_verified_deep_strict"])
            self.assertFalse(manifest["build"]["developer_id_signed"])
            self.assertFalse(manifest["build"]["notarized"])
            self.assertFalse(manifest["market_pin"]["bundled"])
            self.assertEqual(manifest["market_pin"]["sha256"], PIN_SHA)
            self.assertEqual(manifest["market_pin"]["url"], PIN_URL)
            for name, record in manifest["members"].items():
                path = out / name
                self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), record["sha256"])
                self.assertEqual(path.stat().st_size, record["bytes"])
                self.assertEqual(oct(path.stat().st_mode & 0o777), record["mode"])
            app = out / "QCU市场安装准备器.app"
            signature = subprocess.run(["/usr/bin/codesign", "--verify", "--deep", "--strict", str(app)],
                                       capture_output=True, text=True, timeout=20)
            self.assertEqual(signature.returncode, 0, signature.stderr)
            signature_info = subprocess.run(["/usr/bin/codesign", "--display", "--verbose=2", str(app)],
                                            capture_output=True, text=True, timeout=20)
            self.assertEqual(signature_info.returncode, 0, signature_info.stderr)
            self.assertIn("Signature=adhoc", signature_info.stderr)
            self.assertIn("TeamIdentifier=not set", signature_info.stderr)
            runtime = app / "Contents/Resources/prepare-market.sh"
            self.assertEqual(runtime.read_bytes(), SOURCE.read_bytes())
            self.assertEqual((out / "prepare-market.sh").read_bytes(), SOURCE.read_bytes())
            for path in [runtime, out / "prepare-market.sh", app / "Contents/MacOS/applet"]:
                self.assertTrue(os.access(path, os.X_OK))
            self.assertEqual(list(out.rglob("*.tgz")), [])
            with (app / "Contents/Info.plist").open("rb") as stream:
                info = plistlib.load(stream)
            self.assertEqual(info["CFBundleShortVersionString"], "0.1.0-bootstrap.1")
            decompiled = subprocess.run(["/usr/bin/osadecompile", str(app / "Contents/Resources/Scripts/main.scpt")],
                                        capture_output=True, text=True, timeout=20)
            self.assertEqual(decompiled.returncode, 0, decompiled.stderr)
            self.assertIn('buttons {"稍后", "复制安装路径"}', decompiled.stdout)
            self.assertIn('if button returned of choice is "复制安装路径" then', decompiled.stdout)
            self.assertIn("set the clipboard to packagePath", decompiled.stdout)
            checksums = (out / "SHA256SUMS").read_text()
            for line in checksums.splitlines():
                expected, name = line.split("  ", 1)
                self.assertEqual(hashlib.sha256((out / name).read_bytes()).hexdigest(), expected)
            before = {str(p.relative_to(out)): p.read_bytes() for p in out.rglob("*") if p.is_file()}
            again = subprocess.run(command, capture_output=True, text=True, timeout=30)
            self.assertNotEqual(again.returncode, 0)
            self.assertEqual(before, {str(p.relative_to(out)): p.read_bytes() for p in out.rglob("*") if p.is_file()})


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--scratch-parent", type=Path, default=ROOT)
    args, unittest_args = parser.parse_known_args()
    SCRATCH_PARENT = args.scratch_parent.resolve()
    unittest.main(argv=[sys.argv[0], *unittest_args])
