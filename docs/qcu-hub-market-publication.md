# QCU Hub signed market publication / P15

> 2026-10-23 后续：P14 已保留集成，P15.1 已固定公钥并部署现有 Hub 和 mini 默认 DSH；账号本人初始化及登录通过。本文保留 P15 本地候选阶段的记录与维护契约，历史“未部署/未集成”不再代表当前状态。当前固定包、路径、真实通过/未测范围见 [P15.1 部署记录](qcu-hub-market-p15.1-deployment.md)。

Implementation candidate on `dev/qcu-hub-market-publication`, based on
`0ea395cc51ff3244a7c3304fe8d24d0076e7c1f3`. No deployment, real credential, production key, model call or live DSH profile
modification was made. Parent-reviewed source delivery is recorded in the artifact
SOURCE-COMMIT.json; the implementation delegate did not commit or push.
P14 is not integrated. Market version is `0.1.0-pilot.15.0`; Host/Client handshake
protocol 5 is distinct from the catalog schema/protocol 4 and authority fingerprint.

## Route and architecture

1. Import the unchanged schema-1 handoff into the existing password-authenticated,
   loopback-only admin. P10 checks and immutable material inventories remain mandatory.
2. Before approval, enter purpose, scenario, prerequisites, example, permissions,
   evidence boundaries and provenance. The admitted exact market entry, including
   immutable submission permission/evidence declarations, is hashed into approval
   and candidate proposal. It cannot be edited after approval; resubmit and reapprove.
3. Prepare a candidate. This does not publish. Independently preview publication
   and explicitly confirm its submission/materials/candidate/entry/approval/current
   revision/previous fingerprint. Stale proposals refuse. Identical request retries
   recover the same durable intent; all historical versions, including withdrawn
   ones, prohibit different bytes for the same product/version.
4. The publisher holds an exclusive process lock. It stages exact immutable TGZ,
   signed catalog and cumulative download allowlist, verifies durable signatures
   and active archive hashes, saves a private immutable intent/audit, then atomically
   replaces `current.json`. File and directory writes are fsynced. Private HTTP
   verification receipts are separate from immutable audits. Restart reads pointer
   truth; a retry can finish a precommit intent, or recheck a committed publication.
5. HTTP self-check downloads the exact catalog and affected TGZ, verifies signature,
   length and SHA256. A switched pointer without successful check is visibly
   `visible-verification-pending`, never reported as fully verified. Recheck via Web.
6. The read-only overlay in `serve-hub.py` observes current pointer on every request.
   It retains the existing verified static snapshot/whitelist, exact Host checks,
   and adds only `/market/catalog.signed.json` and allowlisted immutable
   `/plugins/<file>.tgz`. All write verbs return 405. No administrator, key, source,
   submission, pointer, audit or directory-browsing routes are exposed.
7. Host refresh verifies the signed authority and returns catalog/fingerprint/state
   through explicit bounded public Typert descriptors. Client uses exact release
   keys, never array indices. Browse/initial catalog load/refresh cannot download
   packages or install/enable. Refresh refuses while review, preparation, official
   request or activation owns state. Connection reset invalidates consent while
   preserving unknown official results for reconciliation.
   A shared mutation gate remains held throughout asynchronous refresh; a second
   ownership check before replacement prevents a late task from being disposed.
8. Download checks exact source/size/SHA and official inspect; explicit installation
   remains `enabled:false`. Separate activation consent covers the exact bundle and
   single row. Host revalidates current authority before preparation and verification;
   Client rechecks before each enable mutation. Withdrawal/update/expiry invalidates
   prior consent even with a cached TGZ. Other installed versions route to official
   details; there is no silent overwrite/downgrade. Script grants/compatibility
   exceptions stop for human review.

Supported admission is one exact component whose row/module/name equals the package
ID: either one same-ID Skill with exact `SKILL.md` SHA, or a single plugin with no
Skill declaration. The latter uses generic tool presentation, not Feishu-specific
instructions. Multi-component products and differently named packaged Skills are
refused with `entry.unsupported_shape_use_single_component`; split the handoff or
extend and review the contract first. Static declarations and human approval do
not prove runtime tool/Skill discovery. P10 and the existing 32-submission store
limit remain; signed catalogs allow at most 100 active products and TGZ is at most
1 MiB. Generic entries display entered instructions and truthful test boundaries.

## Trust and operator setup (not performed against real state)

Node 22+ is required; local verification used Node 25.8.1 and Python 3.9/3.11.
The trusted absolute Node executable is operator-supplied once on the admin/public
CLI. Python invokes only fixed repository `scripts/qcu-market-sign.mjs`, without a
shell, with bounded input/output, 10-second timeout and sanitized environment.
Uploaded sources cannot choose executable/helper/key/root/URL paths.

An operator first creates the private admin store with the existing interactive
password initializer, stops it, then initializes a **new** signing subdirectory:

```sh
rtk proxy python3 hub/admin/server.py --state-root /PRIVATE/ADMIN --init
rtk proxy /TRUSTED/ABSOLUTE/node scripts/qcu-market-sign.mjs init /PRIVATE/ADMIN/signing
```

`init` refuses an existing destination, repository/public overlap and symlink
ancestors; creates a 0700 directory and a 0600 private key without overwrite, and
exports only SPKI public trust to stdout and `public-trust.json`. There is no
startup key generation or production key in source. Only ephemeral disposable test
initializations were run here. Do not place ADMIN or its signing directory under
the public tree; both production roots must be outside Git workspaces and disjoint.

Transfer **only** `public-trust.json` out of band to the release operator. Its
origin must remain `http://192.168.1.68:8080`. Pin it into a reviewed release:

```sh
rtk proxy node scripts/configure-market-trust.mjs /TRUSTED/public-trust.json
rtk proxy node hub/plugins/qcu-market/build.mjs
rtk proxy python3 hub/plugins/qcu-market/pack-pilot.py .work/P15-reviewed-release
```

This task deliberately leaves `publicTrust=null`. Build output and MANIFEST state
**LEGACY ONLY / not dynamic-production-ready**. Legacy bundled behavior is allowed
only with null trust. A configured but invalid/unreachable/expired catalog never
falls back to bundled installation permissions. After the one trust-pinned release
is installed and normally restarted, adding products needs no market rebuild.

Provision a fresh public root by adding the following to the existing admin start
command (include `--init-publication` only once). Reopen with the same paths later:

```sh
rtk proxy python3 hub/admin/server.py --state-root /PRIVATE/ADMIN --publication-root /PUBLIC/MARKET --public-trust /TRUSTED/public-trust.json --node /TRUSTED/ABSOLUTE/node --init-publication
```

The existing public service still requires its independently pinned static manifest:

```sh
rtk proxy python3 hub/release/serve-hub.py --root /STATIC/SNAPSHOT --manifest-sha256 MANIFEST_SHA256 --serve --host 192.168.1.68 --port 8080 --lan-approved --publication-root /PUBLIC/MARKET --public-trust /TRUSTED/public-trust.json --node /TRUSTED/ABSOLUTE/node
```

The repository helper code must exist at the trusted deployment layout; copying
the old standalone static script alone is insufficient for this opt-in overlay.
Admin remains `127.0.0.1`; later tunnel/LAN deployment needs separate authorization.
No change was made to deployed 13.2 or other worktrees.

The exact canonical UTF-8 envelope has schema/keyId/base64-payload/base64-signature;
payload domain is `QCU-MARKET-CATALOG/ED25519/V1`. Node built-in
[Ed25519 sign/verify with null algorithm](https://nodejs.org/api/crypto.html#cryptosignalgorithm-data-key-callback)
is used, without crypto dependencies. Unknown/duplicate/noncanonical fields, wrong
keys/origin, invalid lengths/types/base64, duplicate products and malformed metadata
are refused. Lifetime is bounded to 30 days, issued-time skew to 120 seconds;
publisher currently issues seven-day catalogs. Authority SHA256 covers exact accepted
envelope bytes. Host persists immutable revision/digest high-water records under
private `~/.cache/qcu-market-authority`; package cache is `~/.cache/qcu-market`.
Both reject unsafe links/ownership. Never delete watermark state as rollback.
Missing owned cache ancestors are created with mode 0700 on a fresh Home; linked
ancestors are rejected before any catalog fetch. Signing initialization checks
Git ancestors portably, including worktree `.git` files on other accounts/machines.
Keys/state are trusted local-user material, not an OS sandbox against that user.

## Withdrawal, renewal and recovery

Use “预览撤回” then explicit confirmation to remove an entry from new installation.
Old archive URLs and teacher data remain; no remote uninstall occurs. Use “预览恢复
此版本” on a retained approved candidate to publish an older release under a new,
higher revision. It also supports intentional renewal of the same release before
the seven-day authority expires. No background renewal or automatic rollback runs.
Signing-key rotation needs a separately reviewed trust-pinned release and continued
monotonic revisions; no online key-discovery or rotation protocol is implemented.

### One-time preservation of already-published products

Do not switch teacher clients to dynamic trust with an empty public root. An
operator-only bootstrap command preserves the published teacher-product inventory
from an **independently SHA256-pinned local static Hub snapshot**. It never fetches
metadata/trust roots, imports uploaded code or silently seeds the newer bundled
candidate versions. It requires a separately reviewed schema-4 `seed-catalog.json`
with revision 1, exact dynamic entry fields, `releaseStatus: published`, and the
actual published release's provenance, Skill hash and usage/test boundaries.
Every non-synthetic plugin product in the pinned snapshot must be present exactly
once; the market's self-update and dialogue probe remain in the static channel,
as do separate ZIP guidance files. Omitting an installable product refuses.

```sh
rtk proxy python3 scripts/qcu-market-bootstrap.py --state-root /PRIVATE/ADMIN --publication-root /PUBLIC/MARKET --public-trust /TRUSTED/public-trust.json --node /TRUSTED/ABSOLUTE/node --static-root /STATIC/SNAPSHOT --manifest-sha256 MANIFEST_SHA256 --seed-catalog /REVIEWED/seed-catalog.json
```

Stop the administrator while running this local command; the read-only public
service stays running. Inspect the returned full proposal, manifest/seed digests,
exact versions, source metadata and previous pointer. Run the same command again
with `--confirm-preview EXACT_PREVIEW_DIGEST` only after that review. Preview does
not publish. Confirmation stages all exact TGZs, verifies archive package/name,
version/license/runtime, unique disabled row, declared Skill hash, full dynamic
schema and static snapshot pins, and uses the same atomic commit/HTTP self-check
as normal publication. Retry reconciles durable pre/postcommit intent.

This permits the already-reviewed course workbench's known `qcu-course-draft`
declaration in bootstrap; normal Web admission still refuses that shape. Bootstrap
does not invent a new handoff or generalize the Web checker. Seeded historical
entries have operator bootstrap audits, not synthetic submission approvals;
new Web releases still require a supported real handoff. No real static inventory
was seeded here, and source metadata for the actual deployed course release must
be independently reviewed rather than copied from this branch's newer candidate.

If a precommit intent is listed, reopen its submission and preview/confirm the same
operation. A committed pointer with pending HTTP verification is recovered with
“重新核对公开下载”. Failure before pointer switch retains the complete previous
snapshot; failure after switch is reported from actual pointer truth. Orphan staged
files are retained, never exposed by a previous pointer's allowlist or rewritten.

## Local acceptance and evidence

Use existing dependencies; do not install packages:

```sh
rtk proxy python3 -m unittest discover -s tests -p 'test_qcu_hub_*.py' -q
rtk proxy python3 -m unittest discover -s tests -p test_qcu_submission_check.py -q
rtk proxy python3 -m unittest discover -s tests -p test_hub_python_server.py -q
rtk proxy node --test tests/qcu-market-authority.test.mjs
rtk proxy env QCU_OFFICIAL_DEPENDENCIES=/Users/mcq/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source QCU_BROWSER_DEPENDENCIES=/Users/mcq/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules node --expose-internals --test tests/qcu-hub-publication-browser.test.mjs
```

The browser test uses real admin folder upload, frozen entry, distinct candidate and
publication confirmations, actual signed live public HTTP, actual Host verifier,
actual shared React runtime/flow and real official rc2 Gateway/codecs. Official
manager business effects alone are counted simulations: decline/withdraw produce
zero installs; confirmation produces exactly one disabled install; separate
activation enables exact bundle/row. It checks busy refresh, 390/1120 light/dark
geometry and background colors, page/request failures, screenshots, and closes all
owned processes. This is not a native DSH application or real teacher acceptance.

Machine-readable suite results/logs, source inventory, candidate MANIFEST and
screenshots are in ignored `.work/hub-market-publication/`. `validation.json`
records the 331-test baseline; `parent-final-review.json` adds the final focused
verification and supersedes the delegate sandbox-limited follow-up status; `browser/results.json` contains end-to-end counts and
geometry; `runtime-parity.json` audits exact official ASAR runtime dependencies.
No private signing key, authentication/session state or real user data is exported.

The existing `scripts/prepare-market-http-tests.py` source-equality assertion cannot
run unchanged against this base: the pinned course 1.2 TGZ differs from current
course source in README/client/index/package plus artifact-html/export/prompt/protocol.
These eight files were not changed here. Market regression checks use the exact
hash/size-pinned historical TGZ in isolated extraction instead; its source equality
is not claimed. The existing course-specific market assertions still pass.

For final user acceptance after separate deployment: log in as administrator,
import a real reviewed supported handoff and fill actual usage/provenance boundaries;
approve, prepare, preview and explicitly publish; confirm public HTTP verification.
In a trust-pinned new DSH market, refresh and open that exact product; decline once
and check no installation, then confirm installation and verify disabled state;
separately confirm activation and validate real tools/Skills and teacher workflow.
Repeat withdrawal before consent and network/expiry failures. Native DSH, live Hub,
real signing-root setup, model behavior and teacher acceptance remain **untested**.
Parent reviewed the diff and independently passed six authority tests, all twelve
publication/bootstrap tests after the nested-Skill fix, and an actual hash-pinned
course 1.2 bootstrap preview with pointer revision unchanged at zero. The delegate
follow-up could not bind loopback sockets under its narrower sandbox; that
environment limitation was resolved by the parent test run, not by weakening code.
The three added regressions bring distinct local coverage to 334 tests across the
baseline and affected-suite rerun. Unchanged broad/browser suites were not
needlessly repeated after the server-only bootstrap fix.
