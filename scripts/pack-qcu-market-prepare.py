#!/usr/bin/env python3
"""Build a local macOS candidate with system tooling; never download a package."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import plistlib
import re
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tools/qcu-market-prepare"
TOOL_VERSION = "0.1.0-bootstrap.1"
MARKET_VERSION = "0.1.0-pilot.9.1"
MARKET_SHA = "ecdc4373baad4de8415c27a6b04aa31b9e01ae516a6e3e972660a32bd7108e12"
MARKET_URL = f"http://192.168.1.68:8080/plugins/qcu-market-{MARKET_VERSION}-{MARKET_SHA}.tgz"
SOURCE_COMMIT = "bb1e5c80a01f26f1ab147717cbd9f79b57b198e3"
APP_NAME = "QCU市场安装准备器"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_sources():
    shell = (SOURCE / "prepare-market.sh").read_text()
    for name, value in {
        "QCU_TOOL_VERSION": TOOL_VERSION, "QCU_MARKET_VERSION": MARKET_VERSION,
        "QCU_SOURCE_COMMIT": SOURCE_COMMIT, "QCU_SHA256": MARKET_SHA,
        "QCU_URL": MARKET_URL,
    }.items():
        if re.findall(rf"^{name}='([^']*)'$", shell, re.M) != [value]:
            raise ValueError(f"source pin mismatch: {name}")
    if re.findall(r"^QCU_BYTES=(\d+)$", shell, re.M) != ["43446"]:
        raise ValueError("source pin mismatch: QCU_BYTES")
    ui = (SOURCE / f"{APP_NAME}.applescript").read_text()
    if MARKET_VERSION not in ui or "DSH 0.2.0-rc.2" not in ui:
        raise ValueError("UI baseline mismatch")
    subprocess.run(["/bin/bash", "-n", str(SOURCE / "prepare-market.sh")], check=True)


def build(out):
    if platform.system() != "Darwin" or platform.machine() != "arm64":
        raise ValueError("build requires an Apple Silicon Mac")
    for tool in ("/usr/bin/osacompile", "/usr/bin/codesign"):
        if not Path(tool).is_file():
            raise ValueError(f"missing macOS system tooling: {tool}")
    verify_sources()
    # Exclusive output directory: existing outputs, including symlinks, stay intact.
    out.mkdir(mode=0o700, parents=False, exist_ok=False)
    app = out / f"{APP_NAME}.app"
    result = subprocess.run([
        "/usr/bin/osacompile", "-o", str(app), str(SOURCE / f"{APP_NAME}.applescript"),
    ], capture_output=True, text=True)
    (out / "osacompile.log").write_text(result.stdout + result.stderr)
    if result.returncode:
        raise ValueError(f"AppleScript compilation failed; see {out / 'osacompile.log'}")
    resources = app / "Contents/Resources"
    shutil.copyfile(SOURCE / "prepare-market.sh", resources / "prepare-market.sh")
    os.chmod(resources / "prepare-market.sh", 0o755)
    shutil.copyfile(SOURCE / "prepare-market.sh", out / "prepare-market.sh")
    os.chmod(out / "prepare-market.sh", 0o755)
    shutil.copyfile(SOURCE / "README.md", out / "先读我.md")
    info_path = app / "Contents/Info.plist"
    with info_path.open("rb") as stream:
        info = plistlib.load(stream)
    info.update({
        "CFBundleDisplayName": APP_NAME,
        "CFBundleName": APP_NAME,
        "CFBundleIdentifier": "cn.qcu.market-prepare",
        "CFBundleShortVersionString": TOOL_VERSION,
        "CFBundleVersion": "1",
        "NSHumanReadableCopyright": "QCU · MIT · local preparation candidate",
    })
    with info_path.open("wb") as stream:
        plistlib.dump(info, stream, sort_keys=True)
    shutil.copyfile(ROOT / "LICENSE", out / "LICENSE")
    # osacompile seals its skeleton before we add the runtime and final plist.
    # Renew that local seal only after ALL app writes. '-' uses no certificate,
    # keychain identity, Developer ID or network timestamp service.
    signature_log = []
    for command in (
        ["/usr/bin/codesign", "--force", "--sign", "-", "--timestamp=none", str(app)],
        ["/usr/bin/codesign", "--verify", "--deep", "--strict", "--verbose=2", str(app)],
        ["/usr/bin/codesign", "--display", "--verbose=2", str(app)],
    ):
        result = subprocess.run(command, capture_output=True, text=True)
        signature_log.append(result.stdout + result.stderr)
        (out / "codesign.log").write_text("\n".join(signature_log))
        if result.returncode:
            raise ValueError(f"local app seal failed; see {out / 'codesign.log'}")
    sources = [SOURCE / "prepare-market.sh", SOURCE / f"{APP_NAME}.applescript",
               SOURCE / "README.md", Path(__file__).resolve(), ROOT / "LICENSE"]
    members = {}
    for path in sorted(out.rglob("*")):
        if path.is_file():
            members[path.relative_to(out).as_posix()] = {
                "bytes": path.stat().st_size, "sha256": digest(path),
                "mode": oct(path.stat().st_mode & 0o777),
            }
    manifest = {
        "tool_version": TOOL_VERSION, "market_version": MARKET_VERSION,
        "state": "local-preparation-candidate", "installed": False, "enabled": False,
        "official_confirmation_required": True,
        "support_baseline": "official DSH 0.2.0-rc.2 / macOS Apple Silicon / LAN",
        "market_pin": {"url": MARKET_URL, "bytes": 43446, "sha256": MARKET_SHA,
                       "source_commit": SOURCE_COMMIT, "bundled": False},
        "sources": {p.relative_to(ROOT).as_posix(): digest(p) for p in sources},
        "members": members,
        "build": {"system": platform.system(), "machine": platform.machine(),
                  "tool": "/usr/bin/osacompile", "ad_hoc_signed": True,
                  "signature_verified_deep_strict": True, "developer_id_signed": False,
                  "notarized": False, "native_ui_tested": False,
                  "reproducibility": "source copies are deterministic; compiled app bytes are measured per build"},
    }
    (out / "MANIFEST.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    # The checksum index covers every file except itself, including the manifest.
    checksum_paths = sorted(p for p in out.rglob("*") if p.is_file())
    (out / "SHA256SUMS").write_text("".join(
        f"{digest(p)}  {p.relative_to(out).as_posix()}\n" for p in checksum_paths))
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", required=True, type=Path, help="new output directory; parent must exist")
    args = parser.parse_args()
    try:
        build(args.out.absolute())
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        print(f"QCU_BUILD_FAILED: {error}", file=sys.stderr)
        return 1
    print(json.dumps({"status": "built", "out": str(args.out.absolute()),
                      "native_ui_tested": False}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
