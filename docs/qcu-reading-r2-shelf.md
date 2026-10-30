# QCU Reading R2 shelf · corrected local candidate

qcu-reading@0.2.0-pilot.1，官方DSH0.2.0-rc.2，protocol3/schema3，原有十项peer与唯一默认停用组件保留。R2整理、收藏、搜索、完整备份导出及绑定预览的删除均已实现并完成本地技术验证；schema升级须manual-review。未安装、部署或发布，真人教师/业务采用与Windows未测。

当前候选为修订后的 **56f846b9cfd686008946410bd7f7cb0f352ef7a0ad218927b36213e63fa40901**，641,636字节，30个成员；USTAR载荷2,129,920字节，成员内容2,096,552字节。此前6a1236候选及其证据只作为不可变历史保留，不作当前安装包。

- [当前TGZ](../.work/qcu-reading-r2-shelf/review-final/candidate/qcu-reading-0.2.0-pilot.1-56f846b9cfd686008946410bd7f7cb0f352ef7a0ad218927b36213e63fa40901.tgz)
- [当前完整构建与验证报告](../.work/qcu-reading-r2-shelf/review-final/REPORT.md)
- [当前manifest](../.work/qcu-reading-r2-shelf/review-final/candidate/MANIFEST.json)
- [当前投稿材料](../.work/qcu-reading-r2-shelf/review-final/handoff/submission.json)
- [教师短验收清单](qcu-reading-r2-shelf-checklist.md)
- [已明确的产品事实](../PRODUCT.md)

初始基线为6ee4127d5f44e5d82defc86afed5c67cac529e0e，不冒充新候选的最终提交；父级审阅、提交后将全部30个成员绑定到实际Git提交并另行冻结手稿。初轮完整R2实现之后，修订阶段只改了备份保存状态提示、生成Client及两项相关测试；下方“four scoped source/test files”的统计仅针对修订阶段，不是整个R2源码范围。

## Resulting behavior

Documents have separate optional display title, course/category, deduplicated tags and favorite state, bounded to 180 / 80 / 8×24 characters. Metadata accepts plain text without control/format/bidi or line-separator injection and only known IDs. Document IDs, original names, content/base64, timestamps, paragraphs and locations stay immutable. Notes and historical runs retain their exact source records; aliases never rewrite citations, answers or snippet snapshots.

The compact shelf filters by course, tag and favorites and searches names/titles/course/tags plus imported snapshot text. Original-text matching reuses `searchDocument`, with at most five hits per document and forty across the workspace; results open exact document ID + locator. This is deterministic keyword matching, without a semantic/vector claim. Empty filters can clear; an empty library still offers import. Favorite excerpts are booleans keyed by existing note IDs, with a workspace list opening the preserved source. Note content is not duplicated in storage; unknown/dangling references refuse.

An explicit full JSON backup contains original PDF/DOCX base64, document snapshots, notes, runs and library metadata. Format is `qcu-reading-backup`, version 1, stateSchema 3; `checksum.state` is SHA-256 of UTF-8 `JSON.stringify(state)`. The Client also verifies the complete downloaded byte count and file digest. Existing RPC caps remain 3M request characters / 10M reply characters. Stateless preparation/chunks reserialize a bounded snapshot, transfer at most 256 KiB bytes per base64 chunk, bind the full digest, and refuse state changes. There are no growing export sessions. Cancellation, disposal and workspace changes stop subsequent requests and suppress downloads; the final digest is rechecked before emitting a file. The near-limit fixture contains **7,999,900 bytes of valid state**, with multibyte and escaped text; adding only legal metadata beyond 8 MB refuses without a disk change.

Deletion has a focused inline preview with exact original name/version and note/run counts, explicit cascade language, safe initial cancel focus, Escape and return focus. Two-minute receipts bind document, current stored state, disk digest/identity, workspace and directory identity. Cancellation writes nothing. Confirmation rejects stale, altered, expired, reused, cross-store or active-import/generation values and removes only the target document, its own notes/runs and metadata. No navigation/filter/refresh path deletes. Tests used owned disposable fixtures only.

Schema 1/2 idle loads validate and convert only in memory. Before the first new write, original bytes are synced as `state.schema<old>.<sha>.json`, with nofollow, single-link, inode/owner and workspace guards; incompatible or failed backup blocks continuation and preserves original bytes. Legacy running records retain the previous interrupted-on-open behavior, including pre-write preservation, with no resumed model call. All mutations retain the serial queue and one atomic state.json replacement. File bytes/identity and directory/root identity are rechecked before writes and destructive confirmation, so observed external changes fail closed. This is **not a cross-process lock against an arbitrary writer racing the final check and rename**; maintenance requires stopping the plugin and avoiding concurrent disk edits.


## 修订实现阶段的验证记录

以下保留修订阶段的执行口径；父级追加的独立精确包核对、视觉复核、提交及冻结交付见文末，历史阶段的待办不代表最终交付仍未执行。

### Performed validation

Existing audited Node24.19.0 arm64, official SDK and installed Playwright/Chromium only. No downloads, installs or real models. Counts include Node subtests; repeated source/exact coverage is technical validation rather than teacher acceptance.

| Layer | Source | Exact corrected package |
| --- | ---: | ---: |
| Shelf/status-copy/core/binary/refresh/parser | 83/83 | 83/83 |
| Standalone Client rebuild and offline real parser worker | — | 1/1 |
| Official Cordis/Typert/synthetic LLM/Client lifecycle | 13/13 | 13/13 |
| Actual Chromium reading/refresh/R2 shelf | 3/3 | 3/3 |
| Member/source/vendor identity, market inspection, real checker | — | 2/2 |

Final totals: **source99/99; exact102/102**, no failures/skips. The narrow status-copy regression also passed on its own. The first browser attempt passed2/3 with the new excerpt-line assumption failure described above; the final fresh source and exact browser runs pass3/3. All logs remain under [logs](../.work/qcu-reading-r2-shelf/review-final/logs/).

The regenerated Client is validated by official mount/dispose lifecycle, exact member equality and a byte-identical standalone rebuild. Existing storage, original-source/history, migration backup, deletion receipt/cascade/concurrent writer, consent/cancellation, worker/heap/buffer/archive and near-8MB/chunked-backup tests pass. No storage, protocol, parser or model behavior was edited for this follow-up. The exact offline test probes denied developer filesystem/addon access and a test-only network guard in parent and actual worker; it does not establish a product OS network sandbox.

Each final browser layer retained **38 screenshots** (16 R2, 15 reading, 7 refresh). The R2 flow records zero model resolutions and prepare/start tasks; its synthetic historical seed is explicit. Older Q&A regressions deliberately use synthetic adapters. All final browser flows have zero external requests/page errors and real downloaded checksum/content verification. Fresh exact captures: [prepared/save-confirm status](../.work/qcu-reading-r2-shelf/review-final/exact-browser/shelf/run-YU2OYG/backup-prepared-confirm-system-save.png), [360/dark/font18 long labels](../.work/qcu-reading-r2-shelf/review-final/exact-browser/shelf/run-YU2OYG/long-labels-360-dark-18.png), [desktop light](../.work/qcu-reading-r2-shelf/review-final/exact-browser/shelf/run-YU2OYG/shelf-1280-light-14.png). Implementer render checks were performed; independent visual reviewer/detector remains parent-owned.

All **nine** recorded review-stage loopback servers (including the failed assertion attempt) are unavailable after teardown. Owned Chromium contexts closed; the legacy refresh test awaits context.close without emitting a browserClosed boolean, stated explicitly in the evidence. No parent/native process was inspected or controlled. [Closure audit](../.work/qcu-reading-r2-shelf/review-final/closure-audit.json).

The unchanged checker passes with **0 errors, 0 unsupported, 8 review requirements, approval:required**. Source/preview refer only to performed checks; native/business remain untested. Unchanged market archive reading/inspection accepts the exact shape under the existing tools/pilot-reading policy; frozen old policy still rejects. No production feed or signature. [Checker](../.work/qcu-reading-r2-shelf/review-final/checker-final.json), [market inspection](../.work/qcu-reading-r2-shelf/review-final/candidate/MARKET-INSPECTION.json), [updated handoff](../.work/qcu-reading-r2-shelf/review-final/handoff/submission.json).

## Preservation and remaining boundaries

[Preservation audit](../.work/qcu-reading-r2-shelf/review-final/preservation-audit.json): 1,054 inventoried files checked, 1,050 unchanged, only four scoped source/test files changed. All **252 inventoried initial-stage evidence files** remain unchanged. No old package/report/evidence was overwritten. The only business-source change is the controller notice plus its generated Client; two tests add behavioral/status/render assertions. `package.json` and `view.mjs` are unchanged. [Command/failure index](../.work/qcu-reading-r2-shelf/review-final/COMMANDS.md).

The parent note reports an independent migration probe passing three **source** cases using actual R1-created selfauthored schema1/2 goldens at `/private/tmp/qcu-reading-r2-parent-golden/` and `/private/tmp/qcu-reading-r2-parent-probe.mjs`. This follow-up did not execute that probe or claim independent exact-golden acceptance; parent owns its exact rerun against this corrected candidate.

Starting source baseline remains `6ee4127d5f44e5d82defc86afed5c67cac529e0e`, **not a final candidate commit**. Parent owns final Git commit/rebind/freeze, independent reviewer/detector and any separately authorized native acceptance. No Git, receipts, nested agents/executors, native DSH/Home, credentials, real model, Hub/mini/production or live-data deletion actions occurred.

**Not installed, enabled, deployed, signed or published. Native R2, real teacher/business use and Windows are UNTESTED. Backup remains export-only, without import/restore UI or real-data recovery proof.** Old R1 cannot read schema3; restoring legacy backup loses later records. Existing parser omissions/limits and external-writer maintenance boundaries remain unchanged. Historical reports under the initial stage retain their original artifact references; this report describes the corrected candidate.

## 父级独立复核与当前交付

父级另用冻结R1pilot.4实际创建自编schema1/2记录，未使用R2自身生成旧数据；官方App内置Node24.18.1对当前精确包验证三组旧数据/外部写入场景通过，包括闲置不写、首次变更前旧字节备份、原文和历史保留、完整备份摘要、取消/过期/重复删除拒绝及单目标明确删除。仅在临时测试目录实际删除，无原生或真实资料删除。近8MB状态经原RPC分块导出再次通过；临时签名v3更新清单确认manual-review候选无法直接prepare升级，零归档下载、零生产签名、零新增真实模型调用。

父级独立核对30个TGZ成员与当前源码、精确解包逐字节相同，重建TGZ也完全相同。独立视觉复核的两项文档问题已解决，范围见[UI复核](qcu-reading-r2-ui-review.md)。固定交付目录为 `$HOME/Artifacts/qcu-harness/0.2.0-reading.1/`；最终源码提交、归档成员与Git的一致性、审核材料重新绑定及哈希索引以该目录DELIVERY.md和evidence为准。原始实现阶段报告及其baseline字段保留，不回写历史证据。

当前安装仍为R1pilot.4；R2与市场17.2本机升级待具体固定包确认。R2没有原生、真实教师使用或Windows通过结论，Hub/mini未部署。R3题库尚未开始。
