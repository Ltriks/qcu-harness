# QCU reading Hub package candidate — pilot.4

Implemented only QCU-READING-HUB-PACKAGE. Local candidate, not published or installed. Protocol 2, schema 2, official DSH 0.2.0-rc.2 and the sole default-disabled component remain unchanged. No native DSH, real model/API, real Home/settings/keys, mini or Hub access occurred. Parent owns Git, native acceptance and private receipts.

The final artifact is [qcu-reading-0.1.0-pilot.4-d50d449b06e7840ef30442a13c3bc2b1b1bc7d3e61bdc47c23a807d743d15f50.tgz](../.work/qcu-reading-hub-package/final/qcu-reading-0.1.0-pilot.4-d50d449b06e7840ef30442a13c3bc2b1b1bc7d3e61bdc47c23a807d743d15f50.tgz). SHA-256: `d50d449b06e7840ef30442a13c3bc2b1b1bc7d3e61bdc47c23a807d743d15f50`. It is **628,171 bytes**, with **29 members**, a **2,078,720-byte USTAR payload** and **2,047,607 bytes of file contents**. Every member is UTF-8, at most 1 MiB; the archive is below 1 MiB, the market 80-member / 4 MiB file-total / 5 MiB payload ceilings are respected. Two fresh directories, `final/` and `final-rebuilt/`, have byte-identical TGZ, MANIFEST.json and SHA256SUMS. All final unpacked and source members match the manifest. Detailed hashes: [manifest](../.work/qcu-reading-hub-package/final/MANIFEST.json).

**Why the previous archive failed.** The unchanged `scripts/qcu-check-submission.py` was run on an actual copied pilot.3 archive, SHA-256 `7ff0f9abe7e95775b7f290a60bc8bd9a42353d474a89208b0f8a63cd3a0940b7`, 628,112 bytes. It returned `archive.file_type_unsupported` and `manifest.value`: `pack.py` is forbidden and `vendor/pdf.worker.mjs` is 1,268,229 bytes. The unchanged market `readUpdateArchive` also rejected it with “不支持的包成员”. This is retained in [baseline checker](../.work/qcu-reading-hub-package/baseline-checker.json), [market evidence](../.work/qcu-reading-hub-package/baseline-market.json) and `baseline-handoff/`; no archived pilot.1/2/3 content was altered.

**Build and runtime changes.** `pack.py` remains reproducible maintenance source, excluded from package.files. The packer now fails on forbidden types, NULs, oversized members, excessive counts or payloads, and names needing USTAR prefix/extension records. Sorted USTAR metadata remains uid/gid/mtime 0, mode 0644; gzip has mtime 0 and empty filename. No submitted package scripts are executed.

The already audited same-version modern PDF.js input was investigated. On supplied Node v24.19.0 it fails on `hashOriginal.toHex is not a function`; Uint8Array.prototype.toHex is absent. Raw input hashes and concrete error are in [modern probe](../.work/qcu-reading-hub-package/modern-probe-final.log). Its minified worker also remained over 1 MiB. It was not adopted; no polyfill or substitute parser architecture was introduced.

The final build keeps the existing PDF.js **legacy 6.3.289** input and all existing bounded text-only patches. A pinned-input maintenance build factors unchanged upstream `encodings`, `charsets`, `glyphlist`, `metrics`, `calibri_factors`, `helvetica_factors`, `liberationsans_widths`, `myriadpro_factors`, `segoeui_factors`, and the single lookup helper into a fixed local ESM import, `pdf.font-tables.mjs`. This is compile-time static module factoring with esbuild 0.28.1, not executable blobs, runtime string assembly, eval/Function/data-URL loading, arbitrary load paths or a runtime dependency download. The recipe asserts the exact audited legacy input hashes before factoring. New third-party changes are limited to this build layout; original bounded decoder/image/canvas patches are preserved. Main PDF module, XML parser, DOMMatrix and complete notices are byte-identical to pilot.3. All licenses, input/output hashes and the recipe remain in `vendor/MANIFEST.json`, `vendor.mjs`, vendor-inputs and THIRD-PARTY-NOTICES.txt. Re-staging reproduced the outputs exactly. No security or confirmation bounds were loosened.

An actual worker probe exposed an old test gap: `execArgv: []` removed Node permissions inside the worker. `src/parser.mjs` now preserves an enabled permission mode, explicit filesystem read/write flags, `--no-addons` and `--no-global-search-paths`, while continuing to exclude Host loaders/preloads and not granting nested workers. The exact offline test verifies denied SDK reads and addon permission **inside the real parser worker**, imports actual PDF/DOCX, saves a cell note and original bytes, disposes and reopens with identical documents/state. Node24 has **no network permission scope**: the earlier `permission.has('net') === false` assertion was insufficient. The enhanced test uses a test-only bootstrap to reject network module/builtin access and fetch/WebSocket in parent and worker, probes those rejections, then imports the unchanged packaged parser worker. This is a test restriction, not a claim of product OS sandboxing. Product parsing still uses local bytes, fetch denial and external-resource factories. [Final offline proof](../.work/qcu-reading-hub-package/final/OFFLINE-EVIDENCE.json).

**Final validation on Node v24.19.0 / arm64.** Counts include Node test subtests, with no failures or skips in the final runs; source and exact counts repeat coverage and are not independent business acceptance.

| Validation | Source | Final exact TGZ |
|---|---:|---:|
| Core, binary/security, workspace refresh, added PDF regression | 47/47 | included in 50/50 below |
| Same suite plus offline package and real checker/market packaging regression | — | 50/50 |
| Official Cordis/Typert/LLM synthetic runtime and generated Client lifecycle | 12/12 | 12/12 |
| Actual isolated Chromium reading and refresh flows | 2/2 | 2/2 |

The existing tests retain original-byte/version identity, exact source offsets and physical page gaps, DOCX table row/cell/paragraph semantics, schema-1 byte-exact backup and idempotent reopen, link/hard-link/store bounds, model routing, per-send consent, cancellation/disposal and workspace refresh isolation. Added PDFs exercise compressed content and CID ToUnicode streams with Chinese, accents, Greek and supplementary Unicode; incomplete form warnings; synchronous and streaming 8 MiB buffer / 64 MiB cumulative decoder bounds; actual worker cancellation and timeout. No images/fonts/OCR/native addon or developer dependency is required at teacher runtime.

Final Chromium produced **22 screenshots**, using actual shared UI/controller/disk stores and synthetic adapters: desktop 1280 and narrow 360, light/dark, real PDF/DOCX upload/search/citation/history/export, and refresh preserving drafts/consent. Both final browser servers recorded closure; the preview child exited and its loopback URL stopped responding. Both source browser servers also closed. No external requests or page errors were recorded. Only task-owned processes were stopped; parent previews/native processes were not inspected or stopped. Evidence: [reading](../.work/qcu-reading-hub-package/final-browser/run-IfBSJ4/EVIDENCE.json), [refresh](../.work/qcu-reading-hub-package/final-refresh-browser/run-2vaLGA/EVIDENCE.json). Representative screenshots: [desktop light](../.work/qcu-reading-hub-package/final-browser/run-IfBSJ4/docx-1280-light.png), [desktop dark](../.work/qcu-reading-hub-package/final-browser/run-IfBSJ4/docx-1280-dark.png), [narrow light](../.work/qcu-reading-hub-package/final-browser/run-IfBSJ4/docx-360-light.png), [narrow dark](../.work/qcu-reading-hub-package/final-browser/run-IfBSJ4/docx-360-dark.png). Rendered samples were visually inspected; no clipping/overflow was found in the tested layouts.

**Failures retained honestly.** The exploratory modern build initially passed 40/46 tests and failed 6 PDF cases; final legacy input passed. Initial browser attempts failed 0/2 because the shell sandbox rejected loopback `listen` with EPERM; the scoped permitted retry passed. An enhanced offline fixture initially failed 49/50 due to a duplicate local variable; corrected. A network-test bootstrap had a regex escaping typo (0/1); corrected. Two explicit worker restriction probes failed (0/1 each), exposing the stripped permission flags; the runtime fix above and final 50/50 replaced those results. The first standalone modern probe attached its rejection handler too late; its corrected run records the real compatibility failure. The local Python 3.9 extraction helper rejected a newer `filter` keyword; extraction was redone using validated regular-file member paths. All logs remain under this task's work directory. Earlier `candidate/`, `exact/` and `handoff/` outputs predate the worker fix and are superseded; use **final/**, **final-exact/** and **handoff-final/**.

**Static shape and handoff.** The unchanged checker returns `staticChecksPassed: true`, 0 errors, 0 unsupported, 29 members, **approval: required**, and 8 separate review requirements. `source` and `preview` are passed only for these local tests; `liveInstall` and `businessAcceptance` remain **untested**. [Final checker](../.work/qcu-reading-hub-package/final-checker.json).

The unchanged `readUpdateArchive` and `inspectUpdateArchive` accept the exact TGZ with matching identity, full member fingerprints and peers. Negative hash/peer/member fixtures reject. The matching entry is **synthetic and unsigned**; no real signed directory/publication is claimed. Actual `parseUpdatePayload` with the unchanged product policy rejects qcu-reading as unadmitted. Archive shape is therefore satisfied, while **Hub product admission, update allowlist review and the actual signed directory still require parent/maintainer work**. [Market evidence](../.work/qcu-reading-hub-package/market-evidence.json), [synthetic entry](../.work/qcu-reading-hub-package/synthetic-entry.json).

The frozen review handoff is [handoff-final/submission.json](../.work/qcu-reading-hub-package/handoff-final/submission.json), with archive, member manifest, full license/notices, PLUGIN-SPEC, BUILD, SOURCE, components/peers/permissions, structured source/preview evidence, native/teacher untested evidence, logs and screenshots. `sourceRevision` is the actual baseline **9d0fe732a34df0ce17e16bacf8d2f264a21b6788**, explicitly described in SOURCE.md as an **uncommitted candidate limitation**. It is not a claimed commit of pilot.4. Parent must review/commit this scoped source, rebind metadata to that exact commit and freeze a new handoff. No placeholder revision or pilot.3 native result was substituted. [Structured validation](../.work/qcu-reading-hub-package/validation-evidence-final.json).

All 64 inventoried old archive/manifest and checker/update-policy files retain their starting SHA-256; all 29 packaged source files match the final exact archive. [Preservation proof](../.work/qcu-reading-hub-package/preservation-final.json). No other plugin, Hub/admin policy, official source, root README, R1b/roadmap/refresh report, task draft or old artifact was edited. No Git commit/push/release was made. The task draft remains present and parent-owned.

**Reproduction.** Use existing audited inputs only: QCU_OFFICIAL_DEPENDENCIES=`/Users/mcq/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source`; QCU_BROWSER_DEPENDENCIES=`/Users/mcq/.cache/codex-runtimes/codex-primary-runtime/dependencies/node`; Node24 is its `bin/node`; optional re-stage DOMMatrix input is `/private/tmp/qcu-reading-r1b/dommatrix-3.1.2/package`. No installs/downloads. Set TMPDIR and browser output variables under `.work/qcu-reading-hub-package/`, using new directories. Actual commands are reflected in the final logs; core commands after setting those environment variables are:

```sh
rtk proxy "$QCU_NODE24" hub/plugins/qcu-reading/vendor.mjs --stage
rtk proxy "$QCU_NODE24" hub/plugins/qcu-reading/build.mjs
rtk proxy python3 hub/plugins/qcu-reading/pack.py .work/qcu-reading-hub-package/reproduction-NEW
rtk proxy "$QCU_NODE24" --test tests/qcu-reading-core.test.mjs tests/qcu-reading-binary.test.mjs tests/qcu-reading-workspaces.test.mjs tests/qcu-reading-hub-parser.test.mjs
rtk proxy "$QCU_NODE24" --experimental-transform-types --expose-internals --experimental-loader ./tests/support/feishu-official-loader.mjs --test tests/qcu-reading-official.test.mjs
rtk proxy "$QCU_NODE24" --test tests/qcu-reading-browser.test.mjs tests/qcu-reading-workspaces-browser.test.mjs
rtk proxy "$QCU_NODE24" --test tests/qcu-reading-package.test.mjs tests/qcu-reading-hub-package.test.mjs
rtk proxy python3 scripts/qcu-check-submission.py --submission .work/qcu-reading-hub-package/handoff-final/submission.json
```

For exact tests set QCU_READING_PACKAGE_ROOT to the absolute `final-exact/package` path and QCU_READING_PACKAGE_DIR to `.work/qcu-reading-hub-package/final`; omit PACKAGE_ROOT for source tests. The trusted local handoff construction recipe is `.work/qcu-reading-hub-package/handoff.py`. The official target Node24.18.1 was not run here; final native DSH install/enable/interaction on that target, real-model validation if authorized, teacher acceptance, parent commit rebind, source/license review and product admission remain pending. Existing text-only PDF/OCR/layout/font limitations, bounded DOCX support, state capacity and rollback limitations remain as documented in the plugin README.

**Final member sizes** (package/ prefix omitted; per-file SHA-256 in the manifest):

| Member | Bytes |
|---|---:|
| `LICENSE` | 1,073 |
| `README.md` | 11,287 |
| `build.mjs` | 800 |
| `client.js` | 54,991 |
| `cordis.patch.yml` | 99 |
| `index.js` | 3,826 |
| `package.json` | 1,581 |
| `src/controller.mjs` | 13,207 |
| `src/dispatch.mjs` | 1,675 |
| `src/model.mjs` | 4,706 |
| `src/parser-worker.mjs` | 14,212 |
| `src/parser.mjs` | 3,073 |
| `src/plugin.mjs` | 1,818 |
| `src/protocol.mjs` | 13,969 |
| `src/reports.mjs` | 3,577 |
| `src/source.mjs` | 4,096 |
| `src/store.mjs` | 21,418 |
| `src/view.mjs` | 22,892 |
| `src/zip.mjs` | 4,692 |
| `vendor-inputs/core-js-LICENSE.txt` | 1,134 |
| `vendor-inputs/saxes-LICENSE.txt` | 3,004 |
| `vendor.mjs` | 10,250 |
| `vendor/MANIFEST.json` | 4,479 |
| `vendor/THIRD-PARTY-NOTICES.txt` | 17,984 |
| `vendor/dommatrix.mjs` | 33,912 |
| `vendor/pdf.font-tables.mjs` | 235,851 |
| `vendor/pdf.mjs` | 495,025 |
| `vendor/pdf.worker.mjs` | 1,035,415 |
| `vendor/xml.mjs` | 27,561 |

## Parent independent review (2026-10-30)

Parent reviewed the static font-table factoring, pinned legacy inputs and retained decoder/resource bounds; verified all29 archive members equal source and independently rebuilt TGZ/manifest/checksums byte-identically. Controller/view/model/store/parser-worker/zip/source and full third-party notices remain byte-identical to reviewedpilot.3. Parent independently reran the exact package parser/checker/market/offline suite6 tests, official generated Client1 test and real Chromium full flow1 test:8/8 passed. Its browser and loopback server closed with0 external requests/page errors; representative desktop/narrow light/dark and accounting confirmation screenshots were actually viewed.

Separately, parent ran the exact candidate under the installed official application embedded Node **24.18.1 / arm64** in pure Node mode (no additional GUI/Home/Key/model): real selfauthored two-pagePDF and ChineseWord imported, physical page2 and table row2/cell2 were correct, a note persisted and reopened. This is runtime compatibility evidence, not nativepilot.4 installation. Installedpilot.3 completed the separately authorized native and one real-model acceptance, documented in[原生验收](qcu-reading-native-acceptance.md); that result is not substituted forpilot.4 native status.

Fixed parent artifact root:`/Users/mcq/Artifacts/qcu-harness/0.1.0-reading.4/`, including package, safe handoff, independent evidence and acceptance instructions. Exact committed source identity will be bound in `evidence/SOURCE-COMMIT.json` and a newly frozen handoff after the scoped parent commit. Product admission/update-policy and actual signed Hub publication remain unfinished. No Hub/mini deployment occurred; no real model call was made forpilot.4.
