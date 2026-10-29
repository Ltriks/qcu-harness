# QCU-READING-WORKSPACE-REFRESH

Parent task: qcu-standalone-learning-tools-20261029. Business source is implemented by this codex exec per ancestor AGENTS. Parent owns native acceptance, Git review/push and private receipts. Use rtk for shell commands. Do not spawn subagents or nested executors.

## Baseline and observed defect

Exclusive worktree /Users/mcq/Repos/worktrees/qcu-harness/teacher-reading, branch dev/qcu-teacher-reading, clean baseline and remote 78d8234ff2252b827a6ab89a3e6db8a5e12bbc98. Installed immutable pilot.2 remains under independent native acceptance; never change installed files or that archive.

Parent reproduced in real official DSH 0.2.0-rc.2 / Node24.18.1: enable the qcu-reading package and sole component, open reading, then add a new workspace through official Add workspace. Returning to reading retains only default-workspace in its picker. A normal full restart discovers the new workspace. Actual code shows ReadingController.boot() fetches workspaces only at remote mount; Panel reopening reuses the controller. Host workspaces route already calls workspaceRegistry.list(). This is a client discovery freshness defect, not lost registry data. Parent is separately validating native PDF/DOCX, with no real model calls yet.

## Required minimal change

Make newly registered workspaces discoverable without restarting DSH. Provide a compact, accessible explicit refresh-workspaces action near the picker; refresh on a suitable existing panel/picker interaction if reliable supported lifecycle makes this simple. Avoid inventing a generic event framework or undocumented SDK API. List refresh must not call a model, import any file, start/cancel a model job or silently send anything.

Preserve valid selected workspace, open document, notes, question, prepared confirmation/consent and running status when only the list changes. Async stale replies, concurrent refresh, disposal/reconnect and failures must not overwrite newer state. If the selected workspace is no longer available, clearly require reselection and invalidate its send confirmation, without deleting snapshots/history or making a model call. Avoid accidentally selecting a newly added workspace and reading its content merely because it appeared. Explicit user selection retains current isolation rules.

Use version qcu-reading@0.1.0-pilot.3 for the new immutable candidate. Protocol2/schema2 and existing storage, parsing, source/consent/route semantics remain unchanged. No parser/vendor/Host changes unless a demonstrated necessity is reported first. Default-disabled bundle remains. JavaScript+React only; no TS migration.

## Allowed edits and outputs

Only relevant qcu-reading controller/view/plugin wiring, protocol VERSION constant, package.json/pack.py version, generated client, plugin README, meaningful reading tests, and a new docs/qcu-reading-workspace-refresh.md report. Do not alter root README, current R1b report/checklist/roadmap or native artifacts; parent manages their current facts concurrently. No unrelated refactor.

Use existing audited dependencies, no install/download: QCU_OFFICIAL_DEPENDENCIES=/Users/mcq/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source and QCU_BROWSER_DEPENDENCIES=/Users/mcq/.cache/codex-runtimes/codex-primary-runtime/dependencies/node. Node24 is at /Users/mcq/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node. Existing vendor stays byte-identical.

Create fresh outputs .work/qcu-reading-workspace-refresh/ including synthetic test results, real browser rendering/screenshots of the refresh interaction and exact TGZ/manifest/rebuild proof. Do not overwrite .work/qcu-reading-r1b-package or stop parent preview servers. Temporary test servers must be stopped at completion.

## Acceptance

Reproduce a mutable workspaces list: initial A, add B after boot, refresh through the real controller/UI without reconnecting; B appears, A and its draft/notes/prepared consent remain intact, no model call. Selecting B uses its own store; missing A invalidates sending safely. Verify error recovery, a stale refresh and disposal; test behavior rather than just presence of strings or wiring.

Build generated Client, run relevant core/official/browser checks, deterministic immutable pack and exact-unpacked checks. A native target is outside this executor scope; synthetic tests must not be called native acceptance. Record final tests and any historical failure honestly. Keep <=1MiB TGZ, all member hashes and current third-party notices. No changes to deployed market/catalog size policy.

## Boundaries

Do not commit/push/deploy, access mini/Hub/real API services, read real Home/settings/credentials, operate any native GUI, install/enable packages, or invoke a real model. No OS security changes, keychain, telemetry changes, App rewrite or new launchers. macOS dialog input/launch-selection problems are parent-side tooling observations, not a reason to modify official DSH. Finish code and concrete evidence, then report exact candidate path/hash, changed files, tests and remaining native work to parent.
