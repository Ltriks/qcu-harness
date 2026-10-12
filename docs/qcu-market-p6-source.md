# QCU-MARKET-P6.3 final refusal copy and source handoff

> 后续父线程验收：215/215本地测试、18/18归档回归及已授权的Hub/mini部署，见[本地验收](qcu-market-p6-parent-validation.md)和[P6.3现场记录](qcu-market-pilot6.3-live-validation.md)。下文保留实现交接时的待测状态，不代表当前部署状态。

Final bounded copy correction on `dev/qcu-market-p6`, base `153170ea35a30e1de6d59ccaf3898d11e662fd19`, per `.ai/tasks/QCU-MARKET-P6-FINAL-COPY.md`. Activation review now says **拒绝／不启用** and declining it says **未授权启用；不会重试。** Installation review retains **拒绝／不安装** and **未授权安装；不会重试。** `decline()` reads the existing review kind before clearing consent; guards, state machine, permissions and mutation behavior are unchanged. One activation-decline regression checks the UI copy, revoked consent and zero bundle/row mutation. Only market advances to **0.1.0-pilot.6.3**; all five Skill1.1 identities, provider, canonical source/provenance, coach, root README and live docs are preserved. No agents, dependency downloads, deployment, actual-profile installation, commits or pushes.

**Parent P6.2 acceptance already happened:** the task brief reports 214/214 (187 source + 15 HTTP + 12 Chromium entries), 18 previously passing packaged official tests, and parent-inspected activation/narrow-layout screenshots, all using a synthetic backend. **Final P6.3 parent acceptance is pending:** parent must rerun the full tests, archive regressions and screenshots against the distinct candidate below. No P6.2 browser or screenshot result is attributed to P6.3.

P6.2 implementation history: the prior task corrected the reproduced static provider race and its official API regression coverage. Those guarantees and reviewed activation behavior are documented below and preserved by P6.3. Parent continues to own Mini/Hub, live coach acceptance and integration. No UI control or Mini changes were performed.

## Reviewed activation amendment (preserved)


The 2026-10-12 user-approved `.ai/tasks/QCU-MARKET-P6-ACTIVATION.md` supersedes two activation confirmations for this catalog’s one-Skill/one-row products. Installation still uses its own explicit consent and remains disabled. **查看启用确认 → 确认启用** reviews the exact bundle plus its sole declared component and both profile/user-privilege effects. `reviewActivate`/`confirmActivate` bind the catalog fingerprint, exact release, five-minute expiry, scoped transport identity and current bundle/live-row inventory. Public Cordis `Service.tracker` identity accommodates traced service wrappers; RPCs still use the original scoped facades and unchanged official codecs. Each mutation rechecks Host and inventory.

After official bundle enable, refreshed inventory either verifies the already active sole row without a duplicate enable or enables exactly the reviewed remaining disabled row by its entryId. An already enabled bundle permits row-only consent. Missing/wrong/multiple declarations, unrelated overrides, version/identity changes or unaddressable rows fail closed; no multi-component choices are inferred. Failed, overridden, unknown or restart-required results stop the sequence, preserve results and partial state, and require new informed consent to resume. No rollback, restart or automatic retry is added.

The cross-entry lock spans both mutations. Returning before a mutation revokes consent; returning/unmounting/reset/disposal during bundle enable prevents any late row enable. Already sent calls are never described as cancelled. Lost/unknown replies retain the lock; `reconcileActivation` reads inventory only and releases it only after observing the sent enable, so a disabled bundle with a lost reply cannot be enabled again. Results and consent live in flow memory; a new flow reads current inventory and requires fresh consent. Official inventory exposes manifest/version/row metadata but no installed-file digest: this does not claim rehashing installed content. Low-level `reviewEnable`/`confirmEnable` remain compatibility APIs and are not used by the single-product UI.

## Reproduced provider correction and guarantee boundary

Before the correction, the new regression mounted two distinct Cordis wrappers concurrently for each of the five original providers. Both `fiber.await()` calls succeeded, while official rc.2 runtime registration retained only one Skill. All five cases failed the new exactly-one-success assertion; see `reproduction-before.txt`. The earlier P6.1 provider review did not test this race and its broad duplicate-refusal claim is superseded.

The fixed provider uses public official APIs: `scopeOf(ctx)` selects the caller's visible scope chain for `skills.list()`, which refuses an already advertised winning same-name Skill, including an unloadable provider candidate. After that check, `registerProvider` synchronously registers the exact `<skill-id>@0.1.0-pilot.1.1` provider name. Official `NamedEntries` insertion throws for a duplicate provider name within one layer, closing the reproduced race for concurrent copies of this release. No module-global lock or official source patch is involved. Static provider `list/get` return fixed readonly candidate/definition data, the official `BUNDLED_SKILL_RANK` and explicit `{modelInvocable:true,userInvocable:true}` policy, preserving the previous runtime defaults. The candidate carries a fixed locator; `get` returns only this exact Skill. SHA256 verification and `config.enabled===true` precede registration. Cordis owns the provider effect and cache invalidation on disposal. Runtime performs no file/network/tools/model/session operations. DSH Scope 0.2.0-rc.2 is now an exact peer alongside DSH Skills and Cordis 4.0.4, using the existing audited tree.

Official tests prove concurrent same-release duplicate refusal in one layer; existing runtime and different-provider same-Skill collisions at higher/lower precedence; an existing unloadable candidate; an exact provider-name collision advertising an unrelated Skill; failed-fiber disposal retaining the winner; winner disposal and fresh replacement; sibling-scope isolation, visible ancestor refusal and scope-owned disposal retaining unrelated global entries. The atomic guarantee is provider-name/layer specific. It does not promise atomic Skill-name exclusion against concurrent arbitrary different provider names or different product versions, future catalog changes, cwd-dependent unseen catalogs, or incomplete discovery. Sibling-scope registrations intentionally remain independent. No live chat discovery or model execution is inferred from invocation metadata.

## Delivered source

- `hub/skill-products/provider-template.mjs`, `scripts/pack-teaching-skills.py`: five independently installable one-Skill/one-id products, now 0.1.0-pilot.1.1. Eight allowlisted resources, exact peers, no dependencies/scripts/build permission, disabled row with `config.enabled:true`, deterministic USTAR/gzip and immutable archive collision refusal. `--check-records` verifies release records without rewriting them. Canonical instructions, license and provenance are unchanged by this correction.
- `hub/market/skill-releases.json`, market package/pack assertions and `src/remote-contract.mjs`: unchanged P6.2 Skill1.1 release identities and market 0.1.0-pilot.6.3. Generated catalog/client retain those records; catalog schema 3/revision 2/protocol 3, strict identity/origin/hash limits and trust/consent checks are preserved. P6.2 HTTP fixtures were refreshed from its final archives; parent must prepare fresh P6.3 fixtures using the commands below.
- `tests/teaching-skill-products.test.mjs`: real official Cordis/Skills/Scope regressions against extracted fixed archives, plus updated product/market version assertions. `tests/qcu-market.test.mjs` pins the new market version. `scripts/verify-market-http-runtime.py` additionally verifies official Scope bytes against ASAR.
- The existing single-confirmation activation behavior is unchanged; P6.3 adjusts only refusal copy in flow/view and adds one activation-decline regression. Five real Skills remain separate from the existing coach plugin. Bounded purpose/examples/provenance/digests remain in catalog/client; full instruction bodies remain only in the Skill archives. Existing cancellation, expired/stale consent, cross-entry locks, uncertainty handling and manager codecs are preserved.

## Provenance and preservation


All five are existing internal MIT sources authored by lqtriks and QCU Harness contributors, not external third-party adaptations. Notes, reading and integrity retain chengyuan source revision `ab362184c917554354486cd13d300f4c934be138` and original hashes; lesson/practice pin pre-P6 canonical drafts at the base commit. Tests verify pinned source hashes through Git objects and byte-identical LICENSE notices. New source retains modification statements. Future reviewed third-party adaptations require `ownership: third-party` / `sourceLabel: 第三方改编`; the parser never turns this descriptive metadata into authorization or remote self-trust.

Coach `src/trusted-release.mjs`, `hub/market/coach-release.json` and coach source are unchanged. Coach P2 SHA256 remains `4ac9b2489ece90098faea5f5d0cf79c6efb2989214eaf74f4e38c4841c2eb060`. All 120 snapshotted prior P2/P5.1/pilot.6/pilot.6.1 artifact/evidence files remain byte-identical. Their candidate manifests are preserved historical evidence. The sole current reviewed market candidate is the P6.3 archive below and in `final/INSTALLATION-CANDIDATE.json`; the five new Skill archives are 0.1.0-pilot.1.1. `repack/` is byte-identical verification evidence only.

The prior P6.2 task verified all 27 protected files unchanged from its task start: canonical SKILL.md/SOURCE.json, activation flow/view source, coach source/trust records, root README directory instructions and `docs/qcu-market-coach-live-20261012.md`. P6.3 intentionally changes only the two refusal-copy expressions in flow/view; its new preservation evidence covers all other implementation and parent docs, plus historical artifacts. The market's own README changes only for the new release/provider guarantees. No official source was edited.

## P6.3 verification actually performed

- 100 affected source tests pass: market, loop, direct UI and activation suites, including the sole new activation-decline regression. Existing installation refusal, disabled install and consent regressions remain intact.
- One focused existing product-suite build/pack regression passes (`--test-name-pattern="market build is current"`): generated-client freshness, exact market version, reproducibility, allowlisted member/source bytes and collision refusal. The remaining provider regressions were not rerun for this copy-only correction.
- Regenerated catalog bytes remain unchanged. All six final archives and their manifests/sums reproduce byte for byte in `repack/`; the five Skill archives also match P6.2 byte for byte. The final market has 14 allowlisted members matching source. Preview compiles using the existing audited local React/ReactDOM/esbuild tree; compilation is not visual acceptance.
- `preservation.json` compares the task-start repository and all 966 historical artifact/evidence files. Only the final copy, market version/assertions/generated client, one activation regression and this handoff change. Skill source/provenance/release records, provider, coach, parent README and live docs remain unchanged. `git diff --check` passes.
- Final P6.3 parent full source, packaged official, HTTP/Chromium and screenshot reruns remain pending. Known sandbox-denied browser tests were not attempted. No deployment or live acceptance is claimed.

P6.3 evidence under `$HOME/Artifacts/qcu-harness/0.1.0-pilot.6.3`: `affected-source-tests.txt`, `market-build-pack-test.txt`, `verification.json`, `preservation.json`, `final/INSTALLATION-CANDIDATE.json`, `final/SHA256SUMS`, per-product manifests and byte-identical `repack/`. Historical P6.2 evidence stays in its original root.

## Historical P6.2 verification

- 187 source/non-network tests pass, including 47 preserved activation tests and the 40-case product suite with 31 added official provider regressions. These cover exact content, disabled config, tamper refusal, candidate/definition/invocation semantics, concurrency, collision and ownership, pinned provenance, deterministic packing, allowlisted members and immutable collision refusal. Existing expired/cancelled, remote metadata, same-version/different-hash, scoped Cordis and consent assertions remain.
- 18 official regressions pass against the exact final extracted market Host/Client archive, including compound activation and reset/disposal during in-flight bundle enable. Official contracts use an in-memory transport and fixture manager effects; no package manager is run.
- 14 official runtime artifacts were audited against on-disk rc.2 ASAR: 13 byte-identical local artifacts, including Skills and Scope; app-boot uses exact extracted ASAR bytes because its local artifact differs.
- All six final archives and their manifests/sums reproduce byte for byte in a distinct repack directory. Market members, provider source, canonical instructions and provenance match source. Preview compiles with the audited local React/ReactDOM/esbuild tree. `git diff --check` passes.
- HTTP/browser execution was deferred during the P6.2 implementation turn. Parent subsequently accepted P6.2 as stated above. Historical P6.1 execution stopped at `listen EPERM: operation not permitted 127.0.0.1`; that evidence remains unchanged. P6.3 HTTP/browser/visual acceptance is still pending; prepare fresh final P6.3 fixtures using the commands below.
- No live Mini/Hub, fresh Home package-manager install, actual-profile behavior, target-chat Skill discovery, model output, teaching outcome or teacher trial was tested. Official inventory exposes name/version/row metadata, not an installed-file digest. Activation does not rehash installed files. Consent/results live in flow memory; reload reads inventory and requires fresh consent.

Historical P6.2 evidence under `$HOME/Artifacts/qcu-harness/0.1.0-pilot.6.2`: `reproduction-before.txt`, `provider-tests.txt`, `non-network-tests.txt`, `packaged-official-tests.txt`, `runtime-parity.json`, `verification.json`, `deferred-checks.json`, `preservation.json`, `prior-artifacts-before.json`, `final/INSTALLATION-CANDIDATE.json` and `final/SHA256SUMS`. Prior P6/P6.1 evidence remains unchanged historical evidence.

## Parent reproduction and deferred commands


Use the existing official dependency tree; do not install dependencies. Node flags support the official TS-source test helpers; the implementation remains JS + React. Python 3.11 is needed by fixture tar extraction.

```sh
cd "$HOME/Repos/worktrees/qcu-harness/market-skills"
export QCU_OFFICIAL_DEPENDENCIES="$HOME/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source"
export QCU_PYTHON="$HOME/.local/bin/python3.11"
export QCU_P6_OUT="$HOME/Artifacts/qcu-harness/0.1.0-pilot.6.3"
export QCU_MARKET_PREVIEW_OUT="$QCU_P6_OUT/preview"
export QCU_COACH_ARCHIVE="$HOME/Artifacts/qcu-harness/0.1.0-pilot.2/coach/qcu-study-coach-0.1.0-pilot.2-4ac9b2489ece90098faea5f5d0cf79c6efb2989214eaf74f4e38c4841c2eb060.tgz"
export QCU_OLD_MARKET_ARCHIVE="$HOME/Artifacts/qcu-harness/0.1.0-pilot.2/market/qcu-market-0.1.0-pilot.2.tgz"
export QCU_MARKET_ARCHIVE="$QCU_P6_OUT/final/market/qcu-market-0.1.0-pilot.6.3-10babbce683fa6052d2b37053cace2a63a3154a7adc9fb77c47290cb88595727.tgz"
export QCU_OFFICIAL_ASAR="$HOME/Documents/Codex/2026-09-30/task-7/official-desktop-csv-pilot/application/DeepSeek Harness.app/Contents/Resources/app.asar"
rtk proxy "$QCU_PYTHON" scripts/pack-teaching-skills.py --check-records --out "$QCU_P6_OUT/final/skills"
rtk proxy node hub/plugins/qcu-market/build.mjs
rtk proxy "$QCU_PYTHON" hub/plugins/qcu-market/pack-pilot.py "$QCU_P6_OUT/final/market"
rtk proxy "$QCU_PYTHON" scripts/prepare-market-loop-tests.py --dependencies "$QCU_OFFICIAL_DEPENDENCIES" --coach "$QCU_COACH_ARCHIVE"
rtk proxy "$QCU_PYTHON" scripts/prepare-market-http-tests.py --dependencies "$QCU_OFFICIAL_DEPENDENCIES" --archive "$QCU_MARKET_ARCHIVE" --old "$QCU_OLD_MARKET_ARCHIVE" --coach "$QCU_COACH_ARCHIVE" --skills "$QCU_P6_OUT/final/skills"
rtk proxy "$QCU_PYTHON" scripts/verify-market-http-runtime.py --dependencies "$QCU_OFFICIAL_DEPENDENCIES" --asar "$QCU_OFFICIAL_ASAR" --out "$QCU_P6_OUT/runtime-parity.json"
rtk proxy node hub/plugins/qcu-market/preview.mjs
rtk proxy node --experimental-transform-types --expose-internals --test tests/qcu-market.test.mjs tests/qcu-market-catalog.test.mjs tests/qcu-market-loop.test.mjs tests/qcu-market-direct-ui.test.mjs tests/qcu-market-activation.test.mjs tests/qcu-market-official.test.mjs tests/qcu-market-client-scope.test.mjs tests/qcu-market-host-official.test.mjs tests/teaching-skill-products.test.mjs
```

Parent runs the final full source command above and these deferred checks in its own environment with freshly prepared final P6.3 fixtures and preview (pending):

```sh
rtk proxy node --expose-internals --test tests/qcu-market-http.test.mjs
rtk proxy node --test tests/qcu-market-browser.test.mjs
```

Archive regression (P6.2 passed; final P6.3 rerun pending):

```sh
export QCU_MARKET_CLIENT_PATH="$PWD/.work/http-e2e/market/package/client.js"
export QCU_MARKET_HOST_PATH="$PWD/.work/http-e2e/market/package/index.js"
rtk proxy node --experimental-transform-types --expose-internals --test tests/qcu-market-official.test.mjs tests/qcu-market-client-scope.test.mjs tests/qcu-market-host-official.test.mjs
```

## Final artifacts

All filenames contain id/version/full SHA256. Exact release/member records are in final manifests; the unified SHA256SUMS is relative to `final/`.

| Product | Bytes | SHA256 |
|---|---:|---|
| qcu-market 0.1.0-pilot.6.3 | 32299 | `10babbce683fa6052d2b37053cace2a63a3154a7adc9fb77c47290cb88595727` |
| qcu-lesson-planning 0.1.0-pilot.1.1 | 4429 | `6f8930d4f12f8f52c93422b41cadd050db374c0fe4ce5c06e8b824e69d672bd4` |
| qcu-tiered-practice 0.1.0-pilot.1.1 | 4434 | `183e63eab27bb13dc98f4bec437028126284459c0eeef294e1ee87e819711052` |
| qcu-note-organizer 0.1.0-pilot.1.1 | 4660 | `9c8f1e50ac4f3aff613678c8c094b4e8f53c0393ca011e7a41ceaa5ab96f67e7` |
| qcu-reading-outline 0.1.0-pilot.1.1 | 4748 | `a0ab4dd00ce1a2b259126a1b11fb1c7f4e7599e13a2318ae3009e03b2cab7a79` |
| qcu-integrity-guard 0.1.0-pilot.1.1 | 5153 | `3136b795de94ffd38d522c3ba5e8ac630fca4759386288aad09dfa15baea62bf` |
