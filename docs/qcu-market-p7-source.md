# QCU market P7.1 external Skill source handoff

> 2026-10-13父线程后续检查：225源码/HTTP＋13浏览器条目、18归档回归通过，截图已人工查看；见[父线程验收](qcu-market-p7-parent-validation.md)。下文保留实现交接时的网络/浏览器待测状态。

Bounded implementation of `.ai/tasks/QCU-MARKET-P7-EXTERNAL-SKILL.md` on `dev/qcu-market-expansion`, base `d1e736ad85dd22fadb8d34d4ac198bbf755996e9`. The new **qcu-team-briefing / 教研简报与工作总结 0.1.0-pilot.1** is a local, unpublished candidate. Market **0.1.0-pilot.7.1** now contains seven real products: six Skills and the unchanged coach P2. Parent owns source review and live acceptance through `docs/qcu-market-user-acceptance.md`.

No additional agents, dependency downloads, deployment, real-profile installation, credentials access, commits or pushes were performed. Only this new handoff is written among root docs. `docs/qcu-market-expansion-plan.md` changed concurrently after the preservation snapshot; this implementing agent never wrote or reverted it. Root README, acceptance docs, original Skills, provider template, five release records and coach trust/source are preserved. All prior captured artifact files remain unchanged. Private work-receipt persistence failed with sandbox permission errors; no central/outbox success is claimed.

## Changed source and product review

- `skills/qcu-team-briefing/`: self-contained Chinese instructions, exact upstream Apache LICENSE, explicit modified-file NOTICE, separate unchanged MIT WRAPPER-LICENSE, and SOURCE.json with all six byte pins. Four modes cover 3P progress/plans/problems, themed teacher newsletters, evidence-based FAQ and general internal communication. Input/purpose/audience/time are used when given; useful drafts proceed without repeated questioning. Unprovided dates, numbers, policies and sources remain pending. In-progress work is never promoted to completion. Drafts require teacher review. Only user-provided text is used; runtime does not browse, access services, message, manipulate sessions/files/tools or invoke models. Original guideline meanings are inlined, including concision, scale, priorities, source attribution, uncertainty and official-response escalation. Original tool-gathering instructions are removed from the injected adaptation.
- `third_party/anthropic-internal-comms/`: precisely the six unmodified files from the parent-provided `/tmp/qcu-market-p7-upstream` fixture. They are provenance text only, never read by the running provider. `REPO_THIRD_PARTY_NOTICES.md` was inspected for applicability: it lists imageio/imageio-ffmpeg, FFmpeg, Pillow and fonts; none are contained in these six selected text files or bundled. It is not copied into the package. All pins also match the parent's `IMPLEMENTATION-START.json`; this agent did not independently fetch GitHub.
- `scripts/pack-external-skill.py`, `hub/skill-products/external-product-input.json`, `hub/market/external-skill-release.json`: independent single-product build; existing five-product packer remains byte-identical. Reuses immutable-write, hashing and peer helpers, with a separate explicit 16-member USTAR/gzip allowlist (mode 0644, uid/gid/mtime 0). No symlinks, scripts, execution dependencies or runtime loader. Upstream source hash/size/revision/URL, Apache license and third-party ownership are checked before output. Fixed archive/member manifests refuse immutable collisions.
- Catalog input and generated snapshot/client merge the explicit external record into the unchanged internal records. Schema 3/protocol 3 remain; reviewed revision advances to 3. Catalog accepts only MIT/Apache-2.0, requires matching provenance/release licenses and ownership labels, and retains exact Hub origin, identity, digest, size and unknown-field checks. Metadata cannot confer trust on remote catalogs. Full instruction bodies and external packages are absent from market. Generic UI gains a 教研沟通与总结 scene/icon. Existing shared views/flow and unmistakably synthetic preview backend are used.
- Market package/runtime/packer version advances to 7.1; package README updated. `scripts/prepare-market-http-tests.py` now requires a separate `--external` archive directory when Skill fixtures are supplied. Tests expand expected seven/six product counts without weakening consent, cancellation, serial lock, unknown-outcome or scope assertions. New tests cover fixed pins, license/source tamper, reproducibility, allowlist, immutable collision, symlink refusal and independent new-product activation.

The provider is copied byte-for-byte from `hub/skill-products/provider-template.mjs`: exact public Cordis 4.0.4, Skills/Scope 0.2.0-rc.2 peers; disabled patch row with `config.enabled:true`; SHA256 and explicit enabled guard before public `registerProvider`; visible name collision refusal; atomic exact provider-name/layer registration; scope-owned disposal preserving unrelated entries. The atomic guarantee does not extend to arbitrary concurrent different provider names or versions. No official source is changed. Installation/activation flow source is untouched. Inventory does not expose installed-file digests, and activation does not claim rehashing those files.

## Actual verification

| Check | Actual result | Evidence under artifact root |
|---|---|---|
| Full applicable market source suites, extracted providers | **210/210 passed**, zero skip/fail | `source-tests-final.txt` |
| Focused final external source/packer/flow suite | **11/11 passed** (included in full total) | `external-tests-final.txt` |
| Exact final archived market official regressions | **18/18 passed**, zero skip/fail | `packaged-official-tests.txt` |
| Official runtime parity | **14 files audited**; 13 exact local artifacts; app-boot uses extracted ASAR bytes | `runtime-parity.json` |
| Skill frontmatter validation | **passed** with existing default python3 | `skill-validation.txt` |
| Archive reproduction | **7 archives + 6 per-directory manifests/sums identical** across final/repack | `verification.json`, individual manifests |
| Protected source/history preservation | **1172/1173 snapshot files unchanged**; sole concurrent change is parent expansion-plan | `preservation-before.json`, `preservation.json` |
| Shared React preview compile | **passed**, synthetic backend | `preview-build.txt`, `preview/` |
| Fresh archived HTTP | Attempted; runner **0/15 pass, 15 fail**, all loopback denied | `http-tests.txt` |
| Browser/visual/screenshots | Attempted; runner **0/1 top-level pass**, loopback failed before Chromium launch | `browser-tests.txt` |
| Whitespace | `rtk git diff --check` **passed** | local check |
| Live installation, target-chat discovery, model output, teacher outcomes | **UNTESTED** | separate user/parent acceptance |

The initial source attempt had two failures: missing freshly prepared `.work/host-check/coach` fixture, and a stale six-card assertion. Preparing the documented fixture and updating the count resolved them; final full run passes. Initial Python3.11 Skill validator failed because `yaml` was absent; existing default python3 ran it successfully, without installing anything.

HTTP/browser blocker: **`listen EPERM: operation not permitted 127.0.0.1`**. One HTTP subprocess exposes the same underlying EPERM as a child-exit assertion. No bypass or global security change was used. No screenshots were produced. Browser code includes new external search/detail/Apache provenance, seven/six/one category counts, unchanged peers, one explicit activation review, navigation/no-mutation and screenshot cases; execution of those cases is pending. These environment failures are not passing network/browser acceptance.

## Exact upstream provenance

Upstream: `https://github.com/anthropics/skills/tree/dbd4588f9e1033efb41dad4bef2f7947c8993d44/skills/internal-comms`, pinned revision `dbd4588f9e1033efb41dad4bef2f7947c8993d44`.

| Upstream path | Bytes | SHA256 |
|---|---:|---|
| skills/internal-comms/SKILL.md | 1511 | `067b7587a344a928fc6534ef66b1bcd591fc7c26d207ea7ca3334aeb678d6475` |
| skills/internal-comms/LICENSE.txt | 11345 | `bc6b3af2f331cbc7fb0da1344efb2cbe5877a31498b4d70dbc7000f3405a1362` |
| skills/internal-comms/examples/3p-updates.md | 3274 | `087e4363c0f3513728a7e695eeb9ead5c3ecd12a4681b59340691180e65b68fc` |
| skills/internal-comms/examples/company-newsletter.md | 3295 | `30f81cfbdb03858a006169c72169024089c7c5d3d32611d337782da4f38c86b5` |
| skills/internal-comms/examples/faq-answers.md | 2366 | `5ecd3356cd6666937f2ebefa753253edfdbdca15e368d07baf398bfcced72484` |
| skills/internal-comms/examples/general-comms.md | 602 | `4d3a4bb198a77626bcf018e96b2b45a2dbabed172d4ade0fcd70d23ae8a47a47` |

Apache-2.0 applies to original and adapted instructions. LICENSE preserves `Copyright 2026 Anthropic, PBC.` and the full upstream license. Adapted SKILL.md and its generated `skill-content.js` copy carry explicit change notices. The unchanged provider wrapper has a separate MIT attribution/license; copied instructions are never relabeled MIT. Catalog/release/package instruction license is Apache-2.0 and source label is 第三方改编.

## Candidate artifacts

Artifact root: `$HOME/Artifacts/qcu-harness/0.1.0-pilot.7.1`.

| Candidate | Bytes | SHA256 |
|---|---:|---|
| qcu-team-briefing 0.1.0-pilot.1 | 18882 | `11a6a616c488afbebc0b1781f3e40039c2e49c697cadee0fc095f2e151d6c2bf` |
| qcu-market 0.1.0-pilot.7.1 | 33544 | `994325afc328e3f18e9bf7dd7c4f042dc03bc3e87369ef3d908cff0c29532288` |

New files: `final/external/qcu-team-briefing-0.1.0-pilot.1-11a6a616c488afbebc0b1781f3e40039c2e49c697cadee0fc095f2e151d6c2bf.tgz` and `final/market/qcu-market-0.1.0-pilot.7.1-994325afc328e3f18e9bf7dd7c4f042dc03bc3e87369ef3d908cff0c29532288.tgz`. Five existing Skill1.1 candidates in `final/skills/` retain their exact reviewed hashes and bytes; their unchanged release identities remain in `hub/market/skill-releases.json`. Coach P2 was not rebuilt; its prior archive remains SHA256 `4ac9b2489ece90098faea5f5d0cf79c6efb2989214eaf74f4e38c4841c2eb060`. `final/INSTALLATION-CANDIDATE.json`, `final/SHA256SUMS`, per-directory manifests and `verification.json` describe the complete local review set. `repack/` is verification evidence, not another release.

## Parent reproduction and pending acceptance

Use only existing audited dependencies and separate disposable `.work` fixtures. Commands below do not install or deploy candidates.

```sh
cd $HOME/Repos/worktrees/qcu-harness/market-expansion
export QCU_OFFICIAL_DEPENDENCIES=$HOME/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source
export QCU_PYTHON=$HOME/.local/bin/python3.11
export QCU_P7_OUT=$HOME/Artifacts/qcu-harness/0.1.0-pilot.7.1
export QCU_MARKET_PREVIEW_OUT="$QCU_P7_OUT/preview"
export QCU_COACH_ARCHIVE=$HOME/Artifacts/qcu-harness/0.1.0-pilot.2/coach/qcu-study-coach-0.1.0-pilot.2-4ac9b2489ece90098faea5f5d0cf79c6efb2989214eaf74f4e38c4841c2eb060.tgz
export QCU_OLD_MARKET_ARCHIVE=$HOME/Artifacts/qcu-harness/0.1.0-pilot.2/market/qcu-market-0.1.0-pilot.2.tgz
export QCU_MARKET_ARCHIVE="$QCU_P7_OUT/final/market/qcu-market-0.1.0-pilot.7.1-994325afc328e3f18e9bf7dd7c4f042dc03bc3e87369ef3d908cff0c29532288.tgz"
export QCU_OFFICIAL_ASAR="$HOME/Documents/Codex/2026-09-30/task-7/official-desktop-csv-pilot/application/DeepSeek Harness.app/Contents/Resources/app.asar"
rtk proxy "$QCU_PYTHON" scripts/pack-teaching-skills.py --check-records --out "$QCU_P7_OUT/final/skills"
rtk proxy "$QCU_PYTHON" scripts/pack-external-skill.py --check-records --out "$QCU_P7_OUT/final/external"
rtk proxy node hub/plugins/qcu-market/build.mjs
rtk proxy "$QCU_PYTHON" hub/plugins/qcu-market/pack-pilot.py "$QCU_P7_OUT/final/market"
rtk proxy "$QCU_PYTHON" scripts/prepare-market-loop-tests.py --dependencies "$QCU_OFFICIAL_DEPENDENCIES" --coach "$QCU_COACH_ARCHIVE"
rtk proxy "$QCU_PYTHON" scripts/prepare-market-http-tests.py --dependencies "$QCU_OFFICIAL_DEPENDENCIES" --archive "$QCU_MARKET_ARCHIVE" --old "$QCU_OLD_MARKET_ARCHIVE" --coach "$QCU_COACH_ARCHIVE" --skills "$QCU_P7_OUT/final/skills" --external "$QCU_P7_OUT/final/external"
rtk proxy "$QCU_PYTHON" scripts/verify-market-http-runtime.py --dependencies "$QCU_OFFICIAL_DEPENDENCIES" --asar "$QCU_OFFICIAL_ASAR" --out "$QCU_P7_OUT/runtime-parity.json"
rtk proxy node hub/plugins/qcu-market/preview.mjs
rtk proxy python3 $HOME/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/qcu-team-briefing
rtk proxy node --experimental-transform-types --expose-internals --test tests/qcu-market.test.mjs tests/qcu-market-catalog.test.mjs tests/qcu-market-loop.test.mjs tests/qcu-market-direct-ui.test.mjs tests/qcu-market-activation.test.mjs tests/qcu-market-official.test.mjs tests/qcu-market-client-scope.test.mjs tests/qcu-market-host-official.test.mjs tests/teaching-skill-products.test.mjs tests/external-skill-products.test.mjs
```

Passed final archive tests can be reproduced after fixture preparation:

```sh
export QCU_MARKET_CLIENT_PATH="$PWD/.work/http-e2e/market/package/client.js"
export QCU_MARKET_HOST_PATH="$PWD/.work/http-e2e/market/package/index.js"
rtk proxy node --experimental-transform-types --expose-internals --test tests/qcu-market-official.test.mjs tests/qcu-market-client-scope.test.mjs tests/qcu-market-host-official.test.mjs
unset QCU_MARKET_CLIENT_PATH QCU_MARKET_HOST_PATH
```

**Pending parent HTTP/browser checks**, exact attempted commands (same dependency/preview variables above):

```sh
rtk proxy node --expose-internals --test tests/qcu-market-http.test.mjs
rtk proxy node --test tests/qcu-market-browser.test.mjs
```

The browser suite serves the compiled preview on temporary loopback and writes screenshots under `$QCU_P7_OUT/screenshots`, including `10-external-detail.png` and `11-external-activation-review.png`. Parent should inspect wide/narrow light/dark layout and new provenance after successful execution. No live/model/teaching claim follows from synthetic fixtures. Source review and these pending checks precede any separately authorized candidate deployment.
