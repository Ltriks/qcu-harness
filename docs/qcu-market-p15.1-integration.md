# QCU market P15.1 bounded integration

> 后续实际部署、公钥固定包与原生升级验收见 [P15.1 部署记录](qcu-hub-market-p15.1-deployment.md)。本页保留固定公钥前的本地集成证据与候选摘要，不能将本页早期候选当作当前安装包。

Task `QCU-HUB-MARKET-P15-ROLLOUT`, local source candidate `0.1.0-pilot.15.1`, Host/Client protocol **6**. Signed dynamic catalog schema/protocol **4** is unchanged. Real Hub deployment and native DSH acceptance are **pending**, owned by the parent.

## Source and preservation

P15 base is `6460f4847343e6a2bddff68999dd4834007e27f1` in this worktree. P14 input is exclusively the parent-frozen uncommitted reviewed snapshot at `/Users/mcq/Artifacts/qcu-harness/0.1.0-pilot.15.1/deployment-20261023/p14-source`, base `1012167a72b7fc43e02290ae2698258efafdb222`; this path is a snapshot, not a Git revision. All **48** files were checked against the adjacent `P14-FROZEN-SOURCE.json` before use. The parent's evidence binds its 19 deployed package members to archive SHA256 `afd2ada38d7039fac2d978314d17f9391bb420d5174fd095ff7d2f7a7be85ec3`.

The five Host update modules (host, archive, policy, storage, model) and four update test/fixture files retain frozen bytes. Update flow/view and overlapping P15 runtime/Host/UI files were merged intentionally. The fixed ten-product update policy, including its public key, is unchanged; its SHA256 is `7c205256efda061997fb3f59001e13305e5d593f4fc956d863096082fa15d38b`. Runtime handshakes bind this digest and the bundled catalog digest. Explicit Typert exposes both `refresh` and all seven update methods; JSON replies are bounded to 524288 bytes for catalog operations and 65536 for update operations. The official app-boot dependency remains pinned to `0.2.0-rc.2`.

P15 publisher/admin/bootstrap, Ed25519 authority, race gate and exact nested course bootstrap remain intact. History retains the frozen extra13.2/course1.2 records plus the exact manifest-verified deployed14.1 archive. Public snapshot manifest `6d2404ffddcaa5f716aaa594aa16eb541f07e5705c2a76785f4962ca5e0d1acd` loads all **28** files; `updates.json` is byte-identical, SHA256 `8be913fdd0a12d36812b43e3b54e348fb45d221228ce6d787e4e733120679034`. Helper/README/private routes remain unavailable; public writes return405, strict Host checks remain. No public files, immutable archives or signed feed were rewritten.

## Integrated behavior

`CatalogRuntime` owns the update flow and current ordinary flows. Refresh holds the shared gate during handshake, durable journal lookup and catalog loading. Update check/download/review/install/recovery/unknown results and ordinary install/activation/review prevent refresh. Updates consult current flows after every refresh. Connection reset invalidates approvals and prevents late refresh responses from replacing current owners. Pending official requests are never automatically cancelled or retried by refresh or unload.

Ordinary mutation checks re-read the update journal while preserving concurrent read-only inventory checks. Update consent still binds installed file bytes, source fingerprint, profile configuration, inventory, enablement and exact receipt. Lost replies retain a lock and durable journal, including when a subsequent check is offline; only explicit read-only recovery/new-process verification can close it. New signed dynamic products still install under P15 authority. Upgrades outside P14's fixed scope are labelled for official-page review; the policy is never expanded from renderer/catalog metadata. Fixed product names fall back to bundled reviewed metadata when absent from the current dynamic catalog.

The compact market header, version page, existing generic-product UI and scoped lifecycle remain. Both “刷新市场” and “检查全部更新” render. Diagnostics remain collapsed.

## Local verification

All suites passed using installed dependencies; no npm install, model, real profile or remote deployment. Official upgrade tests use offline synthetic TGZs and disposable profiles. Test signing material is ephemeral and fixture-only; no real publisher/private key was read, copied, generated or changed. The sandbox denies loopback binding; HTTP/Chromium checks ran with authorized local execution outside that sandbox.

| Suite | Passed |
| --- | ---: |
| P15 signature authority | 6 |
| P14 updates + shared flow regression | 25 |
| Administrator/publication (baseline22 + publication12) | 34 |
| Static Hub + updates route preservation | 10 |
| Focused existing market regression | 194 |
| Official rc2 Host/Client, both public gateway channels | 24 |
| Real official offline upgrade/self-upgrade/config preservation | 5 |
| Exact packed candidate through official HTTP | 16 |
| Real shared React/Chromium publication integration | 1 |

The history-specific11 checks were rerun after merging history and pass. Chromium exercised real upload/review/publication, signed loopback HTTP and official rc2 Gateway with simulated manager business effects. Browse/refresh/update-check caused zero installation; one explicit install remained disabled until separate activation consent. Update-vs-refresh and ordinary-review-vs-update locks were observed. Light/dark390/1120 screenshots cover home/detail/updates with no horizontal overflow, console/page/HTTP failures or external requests;21 screenshots are in `.work/p15-rollout/browser`. Screenshots were visually inspected, including the fixed-name fallback.

Build/pack succeeded. The candidate has **21** allowlisted members, each byte-equal to current source:

- File: `qcu-market-0.1.0-pilot.15.1-f25361a65b21408e89b51030700e3e81b703ba01121932e5b6653f291d3101e0.tgz`
- Size: **72917** bytes
- SHA256: `f25361a65b21408e89b51030700e3e81b703ba01121932e5b6653f291d3101e0`

Machine evidence: `.work/p15-rollout/validation.json`, `results.json`, `source-inventory.json`, `frozen-source-verification.json`, `snapshot-preservation.json`, `candidate/MANIFEST.json`, suite logs and `browser/results.json`.

## Parent acceptance and limits

`src/public-trust.mjs` remains **null**: this artifact uses bundled legacy authority until the parent pins real public material with the existing configure script and rebuilds/rechecks the resulting candidate. That source change will produce a different archive hash. A new15.1 installation can be source-unknown to the unchanged14.1 update feed until a separately reviewed feed includes its exact file records; this fails closed. No independent update feed or signature was generated here.

Parent owns public trust/credentials, real Hub/native rollout and real14.1→15.1 restart/update/unknown-result verification. Native fresh Home, actual installed-product/business behavior and teacher acceptance remain pending. The known course1.2 archive versus1.3 source mismatch remains; only the exact hash/size-verified immutable course1.2 archive was used, with course source untouched. No commit, push, deployment or other-worktree edit was performed.
