# QCU market P13.2 bounded source integration

Task: `QCU-COURSE-BOUNDED-RELEASE`, 2026-10-19. Local source candidate only: market `0.1.0-pilot.13.2`, catalog revision 6, schema/protocol 4. This integrates deployed P13.1's unified Hub UI with the fixed course 1.2 pin. Nine real products remain seven Skills and two plugins; the other eight products' metadata and release pins are unchanged.

## Frozen UI provenance

The integration source is `/private/tmp/qcu-market-p13-1-snapshot`, not the other worktree. Its `PROVENANCE.json` identifies uncommitted P13.1 source and published archive SHA256 `e17f3d38d7feed0048e19534ed779593e7531122b84265e4f4ca90e40234dbb3`. The parent verified all 14 deployed TGZ members against that source and reproduced the exact published client/catalog by deterministic rebuild with the required public build inputs. The recorded base commit is not a commit of these uncommitted changes; no Git revision is invented for the frozen UI.

This integration independently checked every imported file against the provenance byte count and SHA256. The imported build, preview, direct flow, views, styles and version model remain byte-identical to the frozen source. Generated catalog/history/client were rebuilt for P13.2. Existing Host and loop logic remain unchanged.

`hub/market/version-history.json` preserves all 17 frozen records unchanged and appends only deployed market P13.1, using its exact id/version/file/bytes/SHA256/dshVersions from `/private/tmp/qcu-p12-3-preflight-result.json`. `sourceRevision` is that live catalog's `pilot-market-p13-1-unified-versions`. The 18 records exclude unpublished course 1.2 and market P13.2. History remains presentation metadata without installation authority. Installed versions still come only from explicit actual-inventory checks; ambiguous inventory does not invent a version.

## Course pin and acceptance state

- Fixed archive: `/Users/mcq/Artifacts/qcu-harness/0.1.0-course-workbench.1.2/qcu-course-workbench-0.1.0-pilot.1.2-88a55b22561a5f6cf1e7af8d27ad28d074df13db4feb4c9340fddd208f5ad0ec.tgz`.
- Bytes: 51089; SHA256: `88a55b22561a5f6cf1e7af8d27ad28d074df13db4feb4c9340fddd208f5ad0ec`. The archive was read and verified, never rebuilt.
- Source revision: `4354b04f09b7e22f12e3d6bfa9d36804d630674c`; provider: `qcu-course-workbench@0.1.0-pilot.1.2`.
- Skill SHA256 unchanged: `7eb7f221fbf1abb66e33258a1b7f5f337275a7b1861d1fe172bf6cbdedba61ba`.

Prior evidence supplied by the parent: course 1.0's real failure cause remains unknown. Course 1.1 installed/loaded; its real retest confirmed max-tokens failure at 12000. Course 1.2 adds capability-aware low/off/default reasoning policy and a compact complete-generation prompt; 59 related offline checks and 16 synthetic screenshots passed. Native 1.2, real generation success, teacher and Office acceptance remain pending. This integration does not establish a real model fix. Install/enable confirmations, cancellation and state-machine boundaries are preserved.

## Changed files

- Pins: `hub/market/course-release.json`, `hub/market/course-source.json`.
- Frozen source/history: `hub/market/version-history.json`; under `hub/plugins/qcu-market/`: `build.mjs`, `build-versions.mjs`, `preview.html`, `src/direct-flow.mjs`, `src/market-view.mjs`, `src/styles.mjs`, `src/version-model.mjs`.
- Reconciled market files: `hub/plugins/qcu-market/package.json`, `pack-pilot.py`, `README.md`, `catalog-input.mjs`, `src/catalog-core.mjs`, `src/remote-contract.mjs`.
- Generated: `hub/plugins/qcu-market/client.js`, `src/bundled-catalog.mjs`, `src/reviewed-versions.mjs`.
- Tests: `tests/qcu-market.test.mjs`, `qcu-market-catalog.test.mjs`, `qcu-market-teacher.test.mjs`, `qcu-market-tools.test.mjs`, `qcu-market-unified.test.mjs`.
- This release note. The revised `.ai/tasks/QCU-COURSE-BOUNDED-RELEASE.md` was supplied before this integration and left unchanged.

## Scoped verification

Used only the existing official dependency tree at `/Users/mcq/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source` and `tests/support/feishu-official-loader.mjs`. `QCU_COURSE_ARCHIVE` was the fixed archive above; `QCU_FEISHU_ARCHIVE` was the unchanged reviewed Feishu 1.1 archive under `/Users/mcq/Artifacts/qcu-harness/0.1.0-pilot.8.1/`. No dependencies were installed.

- `rtk proxy node hub/plugins/qcu-market/build.mjs`: passed. Repeated build yielded identical client, bundled catalog and reviewed-history bytes.
- `rtk proxy node --experimental-loader ./tests/support/feishu-official-loader.mjs --test` with `tests/qcu-market.test.mjs`, `tests/qcu-market-catalog.test.mjs`, `tests/qcu-market-teacher.test.mjs`, `tests/qcu-market-tools.test.mjs`, `tests/qcu-market-unified.test.mjs`, `tests/qcu-course-market.test.mjs`, `tests/qcu-market-loop.test.mjs`, `tests/qcu-market-direct-ui.test.mjs`, `tests/qcu-market-activation.test.mjs`: **187 passed, 0 failed/skipped**. Includes fixed course archive/source/Skill equality, unchanged other release pins, strict catalog revision, history install rejection, actual inventory and independent install/activation consent.
- `rtk proxy node --test tests/qcu-course-core.test.mjs`: **13 passed, 0 failed/skipped**, with synthetic generation only.
- Frozen source byte equality, original 17 history entries, unchanged eight release pins and existing Host/loop files: passed. `rtk git diff --check`: passed.

Logs: `/private/tmp/qcu-market-p13.2-scoped-tests.log` and `/private/tmp/qcu-market-p13.2-course-core-tests.log`.

Generated SHA256: client `a87f9508a517153d8de132ef1c3396d54d305ff7c0923d93a73024802a9d62cd`; bundled catalog module `24c60cc1fe564a5fbf58c5c1f025382432f6dd76ef40176d4055519295835bba`; reviewed-history module `136b291e7988eee00491ce702ccb964c02482d98d075dbe900917b9648d12429`.

No other worktree writes, recursive agents, deployment, SSH, credentials access, real model calls, archive packaging, commit or push. Parent retains final official HTTP/archive checks, packaging, native preview and runtime/deployment evidence. No native or teacher acceptance is claimed here.

## 父线程发行复核

最终从新TGZ提取市场Host/Client后，227项源码、归档、官方HTTP及新版本管理检查通过，0失败、0跳过。首次HTTP运行受沙箱回环端口和隔离目录写入限制；以正常审批权限重跑后通过。市场14个归档成员逐一匹配源码；其他8个产品完整条目保持一致。共享React合成预览的9产品、7/2分类、10个版本面板、市场7个历史版本与工作台1.2引用检查通过；1120/360 CSS像素、暗亮主题共8张截图，页面异常、外部请求和变更调用均为0。历史默认折叠，检查脚本改为先展开再核对可见文字；未改业务逻辑消除该定位问题。Hub和mini现场结果另记，不能据本地检查认定真实模型已通过。
