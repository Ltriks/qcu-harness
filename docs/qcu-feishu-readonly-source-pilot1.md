# QCU-FEISHU-READONLY-PILOT — local source handoff

2026-10-13. Standalone `qcu-feishu-readonly@0.1.0-pilot.1` for official DSH `0.2.0-rc.2` is ready for parent source/setup review. All current local tests passed. Live acceptance remains pending. No actual document, auth store or actual CLI execution was used. No install, deployment, catalog modification, dependency download, commit, push or agent launch occurred.

Worktree: `market-feishu`, branch `dev/qcu-feishu-readonly-pilot`. Starting HEAD was `65b72751d120ae921ca9f87ac0c8f98f7ae201e6`, the parent's task/acceptance documentation commit above requested base `bbf197d2aa8170f591f5c63cca0fc04dd0b2f605`; ancestry was verified and HEAD was preserved.

## Candidate and review

Source is [the standalone package](../hub/plugins/qcu-feishu-readonly/README.md). Seven regular files; plain JavaScript; no execution dependencies, scripts, binary, Skill provider or Client extension. Exact direct peers: `@deepseek-ai/cordis=4.0.4`, `@deepseek-ai/dsh-tools=0.2.0-rc.2`, `@deepseek-ai/schemastery=3.18.4`. One bundle row, `disabled:true`, with `config.enabled:true` and empty CLI/document defaults. Parent **must pass `enabled:false`** to the official manager install action; rc.2 defaults to enabling if omitted.

Only two public registered tools: outline with no arguments, section with an opaque in-memory receipt and a heading selection. No model call/read at mount. Configuration is immutable per mount and rejects unknown fields; URLs are restricted to one Feishu Wiki/Docx binding. Fixed shell-free argv uses only `wiki +node-get` and `docs +fetch --scope outline|section --detail simple --as user --format json`. Wiki requires exact node identity and `obj_type=docx`; Docx requires matching document identity. Section uses the outline's positive revision and refuses a missing/different returned revision. It pins a snapshot; it cannot prove the latest remote revision has not advanced without a fresh outline.

Receipts bind CLI realpath/stat identity, document, exact agent/session object and session ID; expire after 120 s and are revoked on re-outline/remount/unload. Arbitrary IDs/argv, other callers, changed bindings, stale receipts, unsupported XML and oversized output fail closed. Bounds: one active operation, 32 receipts, 64 headings, 160 characters/title, 256 KiB stdout, 8 KiB stderr, 16,000 section characters, 8 s/child, 150 ms TERM→KILL. Unload unregisters only owned entries and waits for owned children. The core's configurable limits/scope seam is exclusively for trusted isolated tests; no live caller-bypass configuration exists.

Only a minimal environment is forwarded, preserving the real user's HOME. The fixture never reads it. macOS additionally injects `__CF_USER_TEXT_ENCODING`; the test allows that OS-provided key. No wrapper body logs or disk cache. Returned document content enters the normal DSH tool/model/session output and is marked untrusted task data. Embedded commands/links/resource references are never followed. Host and CLI run with application-user privileges; this is not an OS sandbox or global read-only/auth-store guarantee. The CLI can refresh its own normal credentials/cache.

## Official evidence

[SDK audit JSON](evidence/qcu-feishu-readonly-sdk.json) records 77 artifacts across 23 packages. All **70 execution-runtime JS files** in the reachable `@deepseek-ai` import graph match the fixed official ASAR byte for byte. Seven additional files were inspected only for configuration/install behavior. Official package versions and JS resolver fields (`type/main/module/exports`) equal the local dependency manifests; rewritten workspace dependency/peer metadata is explicitly listed. This audit does not claim parity for every third-party or desktop package.

Fixed ASAR SHA256: `18d5036bbb58eaff41d351ede99314b8d06505aec06fb2e164c49874ada30f9e`.

Relevant exact code hashes:

| Artifact | Official SHA256 |
| --- | --- |
| `dsh-tools/lib/index.js` | `40f47709337c3c205d4e09e647f8588f4977e66f6d52f019b3cc7ef81159d84f` |
| `cordis/lib/index.js` | `6a9394c0877ff45218818c6e815edd038f8057e1a1deb390a8d43ec81c57691e` |
| `dsh-settings/lib/index.js` | See full audit JSON |
| `dsh-app-boot/lib/index.js` (review only) | `234db45e1b3f8c683b5bc1f551948b2a2ec52a6468c7b6937725a23f1c0e0d96` |
| `dsh-client-ui-plugin-manager/lib/client.js` (review only) | `a110d985d8f6f76a31048082af675b1c40073e4634aeb0d44bf0e9c8aa5142cf` |

The last two local source files differ from the official ASAR. Their exact official bytes were extracted into ignored `.work/feishu/sdk-review/` for review; neither is imported by this plugin's runtime tests. No patched table-audit interface is used. SDK audit report SHA256: `9e904ed170ecc6c22ca86b6a5d818bfe92e7bbaeca27efbf6b63f7ba40df8981`.

The official Settings implementation projects only volatile fields on active entries. This candidate uses ordinary fields requiring remount, so no interactive form is claimed. Official app-boot loads a profile's `cordis.patch.yml`; the package README supplies the exact supported override shape. Disabled-profile configuration and reconciliation are **not live-tested**. Public CLI source confirms fixed flags, positive revision propagation and bounded read options: [official fetch implementation](https://github.com/larksuite/cli/blob/main/shortcuts/doc/docs_fetch_v2.go), [official contract tests](https://github.com/larksuite/cli/blob/main/shortcuts/doc/docs_fetch_v2_test.go). It does not establish compatibility with the installed CLI's precise XML response.

## Actual validation

| Check | Actual result |
| --- | --- |
| Source synthetic process + official Cordis/ToolRuntime suite | **19 passed, 0 failed**, Node 25.8.1; `.work/feishu/source-tests.tap` |
| Deterministic pack/metadata/immutable collision/source scan | **3 passed, 0 failed**, Python 3.9.6 |
| First archive extraction + same full suite | **19 passed, 0 failed**; `.work/feishu/archive-tests.tap`; final archive has identical JS members, README was clarified afterward |
| Final archive extraction + selected registration/ownership/approval/unload/setup tests | **7 passed, 0 failed** (includes heading parser matching the selection pattern) |
| Source-vs-ASAR runtime/config audit | 70/70 runtime files identical; two review-only drifts explicitly handled |
| Archive SHA/member hashes and extraction | Verified all seven regular allowlisted members, fixed modes/times, no links/binaries |
| Scoped diff/whitespace | Clean; existing tracked files/catalogs unchanged |
| Live/profile/model/teacher tests | **Untested**, parent-owned |

Cases include Wiki/Docx exact argv, user identity, shell/control injection, wrong resource type/identity, auth missing/expired with safe errors and no retry, malformed/oversized stdout/stderr, bounded headings, unknown IDs/args, no-outline, changed caller/session/document/CLI, expiration before/during read, revision mismatch/unavailability/zero, full-fetch refusal, concurrency/receipt pool, abort/timeout/TERM→KILL, guard and around-wrapper denial before subprocess, official approval rejection/allowed-once, duplicate registration rollback and unrelated-tool preservation. Fixture bodies are synthetic; embedded sheet/command content produces no extra CLI call. The wrapper source has no credential/body read/write/log operation.

Initial exploratory runs found two fixture issues (macOS-injected environment key and fixture exit before large-pipe flush); both were corrected. No current failing test remains. The SDK dependency setup works locally; there is **no demonstrated tool execution SDK blocker**. The loader prints Node's experimental-loader warning; it is a local test mechanism, not bundled code.

## Artifact

Final TGZ: `qcu-feishu-readonly-0.1.0-pilot.1-9370-2f4a0c3f9988ad8faef05c251020c9b96722e0fcff3683ec37f22105e6d5293a.tgz`

- Size: **9,370 bytes**.
- SHA256: **`2f4a0c3f9988ad8faef05c251020c9b96722e0fcff3683ec37f22105e6d5293a`**.
- Companion `.tgz.json` SHA256: `790c96dd8599988aca88b3c558caa5c1dd084d6a6fcb24a3c9c54c443ee22e3e`; includes every member hash and exact peers.
- Location: `$HOME/Artifacts/qcu-harness/0.1.0-pilot.8.1/`.
- The earlier 9,252-byte local pack is preserved as an intermediate; use only the final hash above. All pre-existing artifacts are preserved. No marketplace release entry was changed.

## Exact parent local reproduction

Run from this worktree. These commands use existing audited dependencies, synthetic fixtures and ignored `.work`; they do not install or launch the application:

```sh
rtk proxy mkdir -p .work/feishu
rtk proxy python3 scripts/verify-feishu-sdk.py --asar "$HOME/Documents/Codex/2026-09-30/task-7/official-desktop-csv-pilot/application/DeepSeek Harness.app/Contents/Resources/app.asar" --dependencies "$HOME/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source" --out .work/feishu/runtime-parity.json
rtk proxy env QCU_OFFICIAL_DEPENDENCIES="$HOME/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source" node --loader ./tests/support/feishu-official-loader.mjs --test tests/qcu-feishu-readonly-official.test.mjs
rtk proxy python3 -B tests/test_feishu_readonly_pack.py
rtk proxy python3 scripts/pack-feishu-readonly.py
```

Verify/extract the reviewed archive without installation:

```sh
rtk proxy python3 - <<'PY'
import hashlib, json, tarfile
from pathlib import Path
name = 'qcu-feishu-readonly-0.1.0-pilot.1-9370-2f4a0c3f9988ad8faef05c251020c9b96722e0fcff3683ec37f22105e6d5293a.tgz'
archive = Path.home() / 'Artifacts/qcu-harness/0.1.0-pilot.8.1' / name
manifest = json.loads(Path(str(archive) + '.json').read_text())
assert hashlib.sha256(archive.read_bytes()).hexdigest() == manifest['sha256']
with tarfile.open(archive, 'r:gz') as t:
    assert sorted(t.getnames()) == sorted('package/' + n for n in manifest['members'])
    for member in t.getmembers():
        assert member.isfile()
        body = t.extractfile(member).read()
        assert hashlib.sha256(body).hexdigest() == manifest['members'][member.name.removeprefix('package/')]
        target = Path('.work/feishu/extracted') / member.name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(body)
PY
rtk proxy env QCU_OFFICIAL_DEPENDENCIES="$HOME/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source" QCU_FEISHU_EXTRACTED="$PWD/.work/feishu/extracted/package" node --loader ./tests/support/feishu-official-loader.mjs --test tests/qcu-feishu-readonly-official.test.mjs
```

## Pending parent acceptance

1. Review setup and use the official install action with explicit `enabled:false` in a parent-approved isolated profile. Configure ordinary fields using the supported profile patch; separately activate. No source command here performs it.
2. Confirm the teacher's trusted native CLI/version/auth and the actual `simple` outline XML contains usable heading IDs. Current parser accepts flat h1–h9 fragments with plain/entity-escaped titles; nested/alternate formatting fails closed. If incompatible, return a sanitized synthetic contract sample for a bounded source revision. Do not claim this wire-shape check passed.
3. Run real DSH outline → user-selected section; check revision snapshot, stale/session/binding refusal, unload and policy behavior. Confirm current model/document-content consent and teacher usefulness. Fixture success is not live/model/teaching acceptance.

Private work receipt central/outbox writes were denied by this sandbox. Safe payloads remain in ignored `.work/feishu-private/` for parent recovery; they have not been delivered to the central private receipt store.
