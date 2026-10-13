# QCU market P8.1 tool-only catalog source handoff

> 父线程后续：273市场测试、20归档回归与截图人工查看通过；用户明确授权后已发布既有LAN Hub，20项发布检查通过，DSH安装/验收由用户完成。见[发布记录](qcu-market-p8-hub-deployment.md)、[父线程交付检查](qcu-market-p8-parent-validation.md)与[用户验收步骤](qcu-market-p8-user-acceptance.md)。下文保留实现交接时HTTP/浏览器阻塞状态。

2026-10-13. Implemented `.ai/tasks/QCU-MARKET-P8-INTEGRATE.md` in `market-integration`, branch `dev/qcu-market-p8`, source base `714002b2f4e9b0cdbc4f9995609342bfdf05e8a4`. Market **0.1.0-pilot.8.1** pairs **schema4 / reviewed revision4 / protocol4** with catalog SHA256 `3364e5122184fd72423bfddcded4ee344df2e1b1eb83340dcf3739324cdb17ea`. Source and archive checks pass; HTTP and browser acceptance remain blocked by this sandbox. Parent review and native user acceptance are pending. No deployment, live profile, real document/authentication call, dependency download, agent, commit or push was performed. No private parent wire script was imported or executed.

## Product and implementation

Eight fixed products: six Skill cards, the unchanged coach P2 plugin carrying a real Skill, and **飞书文档只读** carrying two tools and no Skill. Mandatory capabilities are exactly `['skill']` or `['tools']`; `kind:'skill'` requires the former, `kind:'bundle'` permits either known set. A tools-only release must set `skill`, `skillSha256` and `provider` to null together. Empty/unknown/duplicate/mixed capabilities, mismatched kinds, fake Skill identities and any null combination in a real Skill are refused. The parser and Host byte-download/cache checks share the release validator. Capability arrays and catalog entries are frozen. No remote catalog, dynamic trust, arbitrary origin/URL/script or metadata authorization was added.

Old seven release objects retain exact values and hashes. Release/install/activation identity remains id/version/archiveSHA; runtime and receipts bind the new catalog fingerprint. Missing/stale runtime asks for a normal DSH restart without preparing or installing. Exact old P7 protocol3 Host + new archived Client4, and new archived Host4 + old P7 Client3, were tested through the official in-memory Gateway. Neither reaches download or manager calls.

The new `hub/market/feishu-release.json` maps the separately reviewed standalone status to the current local unpublished catalog status; the standalone manifest is untouched. Input pins **Feishu0.1.0-pilot.1.1**, 11263 bytes, SHA256 `37376ce5f03d4f0fb459dcf6f888b25f5f78df1f7734cd780c7cfd6d01e91b17`, source `cc54be21d20b37491ea32805b6d58ac36048f1f8`, actual path `hub/plugins/qcu-feishu-readonly`, QCU ownership, MIT and an explicit modification statement. All eight archive members match the preserved source and standalone manifest. There is no fabricated Skill/provider or instruction body in market metadata.

Detail and confirmation text name `qcu_feishu_outline` and `qcu_feishu_section`. The natural request is “先列出已配置文档的目录，等我选择章节后再读取。” Usage and copy labels direct teachers to official plugin settings, a trusted native local CLI absolute path, one authorized document base link without query/fragment, normal user read authorization, target-session tool discovery, then outline/selected-section validation. Developer-machine authorization does not transfer. Loaded inventory does not prove configuration, auth readiness or a successful read. Detail records snapshot/receipt limits and separates prior parent CLI evidence from pending Electron/settings/model/user acceptance. Permissions explain native subprocess/application-user privileges, CLI-owned credential/cache refresh, and selected content entering the current model/session. Market never invokes CLI or patches plugin configuration.

Installation still uses `enabled:false`. One separate activation review binds the exact bundle and sole component. Existing direct-flow/activation/lock/cancel/expiry/unknown-result semantics and source are unchanged. Navigation/startup initiate no RPC or mutations in source/official fixtures. Official configuration and SDK guards are unchanged. Shared UI keeps existing categories, search, icons, focus/back behavior, themes, narrow styles and folded diagnostics. Real browser coverage has been expanded but is unexecuted below; source rendering checks are not visual acceptance.

## Actual verification

Evidence root: `$HOME/Artifacts/qcu-harness/0.1.0-pilot.8.1/integration-checks/`.

| Check | Actual result | Evidence |
| --- | --- | --- |
| Applicable market source/provider suites | **241/241 passed**, zero skip/fail | `source-tests-paired4.txt`, `source-command.json` |
| Exact market archive official suites | **20/20 passed**, zero skip/fail | `archive-tests-paired4.txt`, `archive-command.json` |
| Actual archive P3/P4 mismatch both directions | **passed**, official Gateway, zero preparation/manager calls | Included in both suites above |
| Compiled archived Client4 tools install/activation | **passed**, official manager codecs, synthetic backend only | Included in both suites above |
| Preserved Feishu source suite | **26/26 passed**, synthetic CLI/document/settings only | `feishu-source-tests.txt` |
| Preserved Feishu archive suite | **26/26 passed**, exact archive, synthetic only | `feishu-archive-tests.txt` |
| Feishu deterministic pack checks | **3/3 passed** | `feishu-pack-tests-final.txt` |
| Market official runtime parity | **14 artifacts audited**; 13 matching local JS, app-boot exact extracted ASAR JS | `runtime-parity.json` |
| Feishu public SDK audit | **27 packages / 86 JS artifacts audited**, reported resolver/metadata differences retained | `feishu-runtime-parity.json` |
| Market deterministic package | **passed**, canonical full-hash name, explicit 14 members, equal archive and manifest | `repack/`, `verification.json` |
| Eight actual product archives | **all size/hash checks passed**, fixed Feishu members match source | `../final/INSTALLATION-CANDIDATE.json`, source tests |
| Preservation | **630 captured files: 609 unchanged, 21 intentional scoped source changes, zero unexpected/missing files** | `preservation-before.json`, `verification.json` |
| Shared React preview compilation | **passed**, synthetic services | `preview-build.txt`, `../preview/` |
| Real archived HTTP suite | **0/16 passed, 16 failed at loopback listen** | `http-tests.txt`, `http-command.json` |
| Browser HTTP-preview entry | **0/1 top-level passed**, rejected before Chromium launch | `browser-tests.txt` |
| Browser direct local-file alternative | **0/1 top-level passed**, Chromium launch denied | `browser-file-tests.txt` |
| Screenshot generation and visual review | **NOT PERFORMED**, no screenshots generated | Browser failures above |
| Diff whitespace and browser script syntax | **passed** | `rtk git diff --check`; `rtk proxy node --check tests/qcu-market-browser.test.mjs` |
| Native DSH Electron install/config/tools/model/teacher acceptance | **UNTESTED** | Requires separately authorized parent/user acceptance |

HTTP and browser failures are environment blockers, not passing acceptance: `listen EPERM: operation not permitted 127.0.0.1`. The optional `QCU_BROWSER_FILE_PREVIEW=1` mode uses the same built UI and existing Playwright/Chromium without a server, allowing only `index.html` and `app.js`; its launch failed at `bootstrap_check_in … MachPortRendezvousServer: Permission denied (1100)` / SIGTRAP. No permission or sandbox workaround was used. This alternative does not substitute for archived HTTP validation. Browser scenarios cover eight/six/two counts, Feishu search/config/source/copy/readiness, per-entry disabled installation and separate activation, parent/row failure stops, zero navigation/startup writes, unknown-result locks, 360px light/dark details and confirmations, and external-request/runtime errors. None of those browser scenarios ran here.

First market source run had two test failures: stale P7 filename expectation, and a fake-slash assertion that accidentally matched the legitimate source path. Both assertions were corrected without relaxing the capability/readiness contract. Final full source run passes 241 tests. Initial Feishu fixture extraction used system Python3.9, which lacks the tar `filter` argument; it was prepared with the already installed Python3.11. First pack-check run lacked its required `.work/feishu-refine/runtime-parity.json`; copying this run's verified report into that isolated expected path resolved it, and the three unchanged pack checks pass. Earlier failure logs remain.

Protected Feishu source, public SDK/test documents, old Skill/provider/release inputs, upstream official tree and all captured historical artifacts remain byte-identical. The 21 changed captured files are market implementation/build/readme, isolated fixture preparation and applicable regression tests. New files are the Feishu catalog release, tools integration tests and this handoff. Root README gains current navigation only; earlier phase documents and parent acceptance/plan are untouched. Preservation coverage is the recorded snapshot, not a claim about unseen files/devices.

## Exact candidates and locations

Artifact root: `$HOME/Artifacts/qcu-harness/0.1.0-pilot.8.1/`.

| Candidate | Bytes | SHA256 |
| --- | ---: | --- |
| qcu-market0.1.0-pilot.8.1 | 36722 | `c646b4f3f392556570110ae3067e0fbbe00f9dc253d08deabb895613e7262c09` |
| Unchanged reviewed qcu-feishu-readonly0.1.0-pilot.1.1 | 11263 | `37376ce5f03d4f0fb459dcf6f888b25f5f78df1f7734cd780c7cfd6d01e91b17` |

Market: `final/market/qcu-market-0.1.0-pilot.8.1-c646b4f3f392556570110ae3067e0fbbe00f9dc253d08deabb895613e7262c09.tgz`. Frozen Feishu: `qcu-feishu-readonly-0.1.0-pilot.1.1-37376ce5f03d4f0fb459dcf6f888b25f5f78df1f7734cd780c7cfd6d01e91b17.tgz` at the artifact root, with its original standalone JSON beside it. Coach stays in pilot.2 and six Skill archives stay in pilot.7.1; the eight exact reviewed paths are in `final/INSTALLATION-CANDIDATE.json`. Separate `preview/` is the shared synthetic preview; `integration-checks/repack/` is verification evidence, not a second release. Market has only bounded metadata, Host preparation and compiled UI; no packages, CLI binaries, full instructions or install scripts.

## Reproduction with existing audited dependencies

The source dependency tree remains the audited public DSH0.2.0-rc.2/Cordis tree. Browser dependencies are the existing primary-runtime Playwright tree and its matching cached Chromium; no newer official-tree Playwright was used and no download occurred. Exact preparation commands are also saved in `integration-checks/preparation-commands.json`.

```sh
cd $HOME/Repos/worktrees/qcu-harness/market-integration
export QCU_OFFICIAL_DEPENDENCIES=$HOME/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source
export QCU_BROWSER_DEPENDENCIES=$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node
export QCU_PYTHON=$HOME/.local/bin/python3.11
export QCU_P8_OUT=$HOME/Artifacts/qcu-harness/0.1.0-pilot.8.1
export QCU_P7_OUT=$HOME/Artifacts/qcu-harness/0.1.0-pilot.7.1
export QCU_COACH_ARCHIVE=$HOME/Artifacts/qcu-harness/0.1.0-pilot.2/coach/qcu-study-coach-0.1.0-pilot.2-4ac9b2489ece90098faea5f5d0cf79c6efb2989214eaf74f4e38c4841c2eb060.tgz
export QCU_FEISHU_ARCHIVE="$QCU_P8_OUT/qcu-feishu-readonly-0.1.0-pilot.1.1-37376ce5f03d4f0fb459dcf6f888b25f5f78df1f7734cd780c7cfd6d01e91b17.tgz"
export QCU_MARKET_ARCHIVE="$QCU_P8_OUT/final/market/qcu-market-0.1.0-pilot.8.1-c646b4f3f392556570110ae3067e0fbbe00f9dc253d08deabb895613e7262c09.tgz"
export QCU_MARKET_PREVIEW_OUT="$QCU_P8_OUT/preview"
export QCU_OFFICIAL_ASAR="$HOME/Documents/Codex/2026-09-30/task-7/official-desktop-csv-pilot/application/DeepSeek Harness.app/Contents/Resources/app.asar"
rtk proxy node hub/plugins/qcu-market/build.mjs
rtk proxy "$QCU_PYTHON" hub/plugins/qcu-market/pack-pilot.py "$QCU_P8_OUT/final/market"
rtk proxy "$QCU_PYTHON" scripts/prepare-market-loop-tests.py --dependencies "$QCU_OFFICIAL_DEPENDENCIES" --coach "$QCU_COACH_ARCHIVE"
rtk proxy "$QCU_PYTHON" scripts/prepare-market-http-tests.py --dependencies "$QCU_OFFICIAL_DEPENDENCIES" --archive "$QCU_MARKET_ARCHIVE" --old $HOME/Artifacts/qcu-harness/0.1.0-pilot.2/market/qcu-market-0.1.0-pilot.2.tgz --previous "$QCU_P7_OUT/final/market/qcu-market-0.1.0-pilot.7.1-994325afc328e3f18e9bf7dd7c4f042dc03bc3e87369ef3d908cff0c29532288.tgz" --coach "$QCU_COACH_ARCHIVE" --skills "$QCU_P7_OUT/final/skills" --external "$QCU_P7_OUT/final/external" --feishu "$QCU_FEISHU_ARCHIVE"
rtk proxy "$QCU_PYTHON" scripts/verify-market-http-runtime.py --dependencies "$QCU_OFFICIAL_DEPENDENCIES" --asar "$QCU_OFFICIAL_ASAR" --out "$QCU_P8_OUT/integration-checks/runtime-parity.json"
rtk proxy node hub/plugins/qcu-market/preview.mjs
rtk proxy node --experimental-transform-types --expose-internals --test tests/qcu-market.test.mjs tests/qcu-market-catalog.test.mjs tests/qcu-market-loop.test.mjs tests/qcu-market-direct-ui.test.mjs tests/qcu-market-activation.test.mjs tests/qcu-market-official.test.mjs tests/qcu-market-client-scope.test.mjs tests/qcu-market-host-official.test.mjs tests/qcu-market-tools.test.mjs tests/teaching-skill-products.test.mjs tests/external-skill-products.test.mjs
rtk proxy env QCU_MARKET_CLIENT_PATH="$PWD/.work/http-e2e/market/package/client.js" QCU_MARKET_HOST_PATH="$PWD/.work/http-e2e/market/package/index.js" node --experimental-transform-types --expose-internals --test tests/qcu-market-official.test.mjs tests/qcu-market-client-scope.test.mjs tests/qcu-market-host-official.test.mjs
rtk proxy node --expose-internals --test tests/qcu-market-http.test.mjs
rtk proxy node --test tests/qcu-market-browser.test.mjs
rtk proxy env QCU_BROWSER_FILE_PREVIEW=1 node --test tests/qcu-market-browser.test.mjs
```

Feishu preservation regressions use its unchanged official loader, this run's SDK audit and safe extraction of the fixed eight archive members into `.work/feishu-refine/extracted/package`, never a live CLI or document:

```sh
rtk proxy "$QCU_PYTHON" scripts/verify-feishu-sdk.py --dependencies "$QCU_OFFICIAL_DEPENDENCIES" --asar "$QCU_OFFICIAL_ASAR" --out .work/feishu-refine/runtime-parity.json
rtk proxy env QCU_FEISHU_OFFICIAL_APP_BOOT="$PWD/.work/feishu-refine/official-sdk/dsh-app-boot/lib/index.js" node --loader ./tests/support/feishu-official-loader.mjs --test tests/qcu-feishu-readonly-official.test.mjs
rtk proxy env QCU_FEISHU_OFFICIAL_APP_BOOT="$PWD/.work/feishu-refine/official-sdk/dsh-app-boot/lib/index.js" QCU_FEISHU_EXTRACTED="$PWD/.work/feishu-refine/extracted/package" node --loader ./tests/support/feishu-official-loader.mjs --test tests/qcu-feishu-readonly-official.test.mjs
rtk proxy "$QCU_PYTHON" -B tests/test_feishu_readonly_pack.py
```

Before any deployment, parent must run HTTP/browser in an environment permitting the existing listener/Chromium, review actual 360px light/dark screenshots and confirmations, then perform separately authorized native acceptance. Synthetic manager effects and prior parent CLI reads do not prove live DSH installation, target-session discovery or teacher/model success. Private work-receipt central and fallback writes were sandbox-denied; no durable receipt success is claimed.
