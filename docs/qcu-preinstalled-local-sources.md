# Clean local-source build input and reviewed expert candidate

This is a build-time preparation step for the next offline suite. It does not repair a used teacher Home, install a full application, or migrate user data. Existing rc.3/r4 installations remain unchanged. Adoption into the final offline builder and a separately designed migration for used Homes are pending.

`scripts/prepare-preinstalled-local-sources.py` accepts only a hash-pinned public input set and a nonexistent output directory. It first reads only `INPUTS.json` and `teacher-manifest.json` (at most 64 KiB each) and checks both explicit trust hashes. Missing inventories fail before tree traversal; wrong hashes fail before any payload is opened. The verified inventories define the exact permitted paths and sizes. Metadata-only enumeration rejects unexpected files/directories, symlinks and special files without reading their contents or descending into unknown directories. Only then does it read pinned payloads, bounded by each declared size, a 1 MiB per-file ceiling and a 4 MiB aggregate ceiling including inventories. Reads are capped even if a file grows after inspection. It verifies all original TGZs and six branding files, rejects unsafe paths, duplicate archive entries and identity/content mismatches, and validates every reconstructed module file against the clean teacher seed inventory. Package bundles include code; the helper treats those bytes as data, performs no installation and executes no package code. This is a frozen build-input tool, not a reader or repair tool for arbitrary Homes; do not modify staged inputs concurrently.

The result retains the ten clean `node_modules` trees, original profile selection order, and original configuration patch bytes. The ten direct dependency declarations become profile-relative `file:./.qcu-bundles/...tgz` sources. Nine archives are copied byte-for-byte. The branding archive is a deterministic **local build artifact**, not a published market product. `PREPARATION.json` inventories every generated payload and its provenance. No account data, registry credentials, caches or machine environment configuration are copied.

The generated `pnpm-workspace.yaml` contains `autoInstallPeers: false` and `ignoreScripts: true` (written as JSON, which is valid YAML). This portable clean-build policy prevents host peer downloads and package scripts. [The pnpm migration guide](https://pnpm.io/migration) explains that pnpm 11 stopped reading `npm_config_*` and moved non-auth/registry settings out of `.npmrc` into `pnpm-workspace.yaml`. Supplying the old environment variables or `.npmrc` policy alone therefore did not establish an effective pnpm 11 policy. This adds build input only; it does not migrate an existing Home.

From the isolated worktree, choose a new output path:

```sh
rtk proxy python3 scripts/prepare-preinstalled-local-sources.py \
  --inputs .work/preinstalled-proof-inputs \
  --output .work/preinstalled-proof/new-prepared-profile \
  --inputs-sha256 b06e8167b009fc9b708fbdee801d7c3cc945326c4d6a84c601c47791a3ef5eec \
  --teacher-manifest-sha256 b3dac199cf39787b6b4d3897adaec085b8a5eb6e1b444e2acc5259729813b7c3
rtk proxy python3 tests/test_preinstalled_local_sources.py -v
```

The prepared candidate is `.work/preinstalled-proof/prepared-profile/`. Preparation is deterministic across independent output locations; the official proof copies it to relocated disposable profiles before installing anything.

For an independent boundary-review proof, regenerate into the fresh `.work/preinstalled-boundary/prepared-profile` path using the same command and trust hashes with that new `--output`. The official test accepts `QCU_PREINSTALLED_PREPARED` (default: `.work/preinstalled-proof/prepared-profile`) and `QCU_PREINSTALLED_OUT` (default: `.work/preinstalled-proof/official`). Select a fresh proof output root to preserve prior evidence:

```sh
QCU_PREINSTALLED_PREPARED="$PWD/.work/preinstalled-boundary/prepared-profile" \
QCU_PREINSTALLED_OUT="$PWD/.work/preinstalled-boundary/official" \
QCU_OFFICIAL_DEPENDENCIES=$HOME/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source \
QCU_EXPERT_BASELINE="$(cat .work/preinstalled-proof/baseline-path.txt)" \
rtk proxy node --experimental-transform-types --expose-internals \
  --experimental-loader ./tests/support/feishu-official-loader.mjs \
  --test tests/qcu-preinstalled-official.test.mjs
```

The input-boundary follow-up leaves all expert runtime/build/package bytes and existing archives unchanged. Its focused open/traversal guards, regenerated-tree parity and actual official installation evidence are recorded separately in `.work/preinstalled-boundary/RESULT.json`. It does not repeat unrelated core/browser suites.

## Bounded parent review

Controlled responses reproduced two failures: a successful start stopped being polled when the following history request failed, and a history response already in flight could restore a deleted row and stale capacity. Polling now starts independently of history refresh and continues observing known running records after read errors. A successful cleanup advances a history generation, rejecting older history/poll snapshots while retaining the polling chain for a different unselected running record. Existing workspace, reconnect and navigation checks remain in place. No start/model request is retried.

History controls fit a 360px panel with a vertical list, three-line task titles, usable checkboxes and keyboard focus controls, readable KB/MB capacity including plugin workspace configuration, and cleanup labels showing task, team, time and status. Raw IDs are in a collapsed technical section. Full task text remains in details and exports. These are the only follow-up expert runtime changes; the cleanup snapshot additionally carries the recorded task time.

The new immutable candidate is in `.work/expert-hardening/candidate-reviewed/`; all prior candidate files and receipts remain intact. The exact archive SHA-256 is `4db68f807362f243f77039d66c09b1981a4b61a93185f37c43731ea001a96581`. The source build, unpacked rebuild and archive payload match. Core, controlled review, official lifecycle and browser checks run on both source and the exact unpacked candidate.

## Official installation evidence

`tests/qcu-preinstalled-official.test.mjs` calls the actual rc2 `PluginManager.installBundle()` and its actual pnpm path, with empty explicit user/global configs, disabled scripts and automatic peers, isolated stores/cache/state, bounded fetch behavior, an empty disposable Home argument, and an intentional loopback 404 registry. Each fresh fixture supplies both `npm_config_*` and `pnpm_config_*` for isolation, including explicit user/global config paths, and isolates XDG config/cache/data/state. For pnpm 11, `pnpm_config_npmrc_auth_file` selects the empty auth file and XDG selects the empty global `pnpm/config.yaml` and `auth.ini`; pnpm 10 reports its isolated XDG `pnpm/rc`, which is created empty and asserted, as its global config. The ambient `HOME` value is not reassigned. Before installation, the real CLI queries only an allowlist of safe config keys: userconfig/globalconfig, auto-install-peers, ignore-scripts, store/cache/state directories, registry and fetch retry/timeout values. Evidence records requested settings, effective values and each query; assertions must pass before the manager starts. Automatic peers and scripts come solely from the copied generated workspace policy, with no fixture environment or `.npmrc` override. No Internet or LAN endpoint is configured. This is configuration/request evidence, not an OS packet capture.

The prior successful proof used Homebrew Node **25.8.1** and `/opt/homebrew/bin/pnpm` **10.32.1**, rather than the frozen rc3 application's bundled runtime. In that environment, the old bare-semver layout fails with `ERR_PNPM_FETCH_404`. The prepared layout installs expert `0.2.0-pilot.1` and upgrades to the reviewed `0.2.0-pilot.2` with **zero registry requests**, separately for selected and unselected expert bundles. All ten existing package trees, original local archives and relative sources, selection flags, component configuration patches and an unrelated synthetic setting are preserved. A corrupt official upgrade is rejected while retaining the prior manifest, lockfile, patches and installed expert bytes.

pnpm reports missing host peers because automatic peer installation is deliberately off. A separate fresh-process check uses the official `loadProfileDirectory`, `createRuntimeResolution`, `PluginPackages` and `Loader.import()` APIs with the trusted SDK installation anchor and synthetic providers; it resolves the candidate and activates its service only in the selected case, without booting teacher base services or calling a model. The source anchor is the SDK's `upstream/source/apps/desktop-host/package.json`: canonicalizing its SDK alias through `require.resolve()` points at an older build with a different dependency closure. No official code or compatibility checks are modified.

Results and exact hashes are in `.work/preinstalled-proof/RESULT.json` and `FINAL-CANDIDATE.json`; the successful official run is under `official-reviewed/`. Browser evidence includes partial-report and cleanup-confirmation screenshots in 1280px/360px light/dark views, downloaded report/backup bytes, and inner list/control overflow measurements. Chromium uses its bundled headless runtime, an isolated profile, sandbox enabled and minimal arguments without security-disable flags.

## Initial bundled rc3 runtime failure (resolved by parent final verification)

The test now accepts `QCU_PREINSTALLED_PNPM_COMMAND` and `QCU_PREINSTALLED_PNPM_ARGS` (a JSON array containing only strings); defaults remain `/opt/homebrew/bin/pnpm` and `[]`. Overrides are captured before inherited environment cleanup. With a command override, `QCU_PREINSTALLED_ELECTRON_NODE=1` explicitly preserves `ELECTRON_RUN_AS_NODE=1` for package-manager children and the separate cold process. Runtime evidence records the actual executable, arguments, Node version and pnpm version. Existing installation, zero-registry, preservation, rollback and cold-load assertions are unchanged.

The fresh run used the application's `Contents/Resources/program/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness` executable for both Node and the pnpm command, with its `Contents/Resources/runtime/pnpm/bin/pnpm.mjs` as the sole pnpm prefix argument. Measured versions were **Node 24.18.1 / pnpm 11.7.0**. It reused the audited SDK/Node flags and baseline from `.work/preinstalled-boundary/OFFICIAL-INVOCATION.json`, copied `.work/preinstalled-boundary/prepared-profile`, and wrote fresh output under `.work/preinstalled-bundled-runtime/official/`. Exact paths, arguments and explicit flags are in `.work/preinstalled-bundled-runtime/INVOCATION.json`.

The sandbox-only attempt failed at loopback bind (`listen EPERM 127.0.0.1`) before any scenario ran; its diagnostic is preserved in `logs/official-sandbox.log`. One subsequent scenario run with sandbox escalation reported **1 test, 0 passed, 1 failed**. The old layout reproduced the expected QCU-package 404. The prepared, unselected layout then failed its baseline install: pnpm warned that the ten seeded modules came from a different package manager and requested host packages, including `@deepseek-ai/cordis`, from the loopback 404 registry despite the configured `auto-install-peers=false`. That prepared phase recorded **15 registry requests**, so the prior zero-registry result does not hold for bundled pnpm 11.7.0. Upgrade, prepared-tree/config parity, corrupt-upgrade rollback, selected layout and cold-load checks were **not reached**. No compatibility workaround or assertion relaxation was applied.

The failure evidence, logs, source hashes and review status are in `.work/preinstalled-bundled-runtime/RESULT.json` and `official/EVIDENCE.json`. The reviewed archive remains exactly `4db68f807362f243f77039d66c09b1981a4b61a93185f37c43731ea001a96581`. This run establishes no model, native application or Hub acceptance.

## Initial workspace-policy fixture failure (resolved by parent final verification)

The fresh `.work/preinstalled-pnpm11/prepared-profile` uses the same frozen input hashes. Compared with the boundary preparation, only `pnpm-workspace.yaml` is added and `PREPARATION.json` gains its inventory entry; existing payloads, original archives, profile declarations and patches are byte-identical. All **15 focused preparation tests passed**, including the generated policy and its inventory hash. Official output directories now also reject existing output.

The specified bundled-runtime test ran **exactly once** in `.work/preinstalled-pnpm11/official` and failed before installation: newly added empty `pnpm_config_proxy` / `pnpm_config_https_proxy` values caused `[ERROR] Invalid URL` during `pnpm --version`. No effective config query or installation/rollback/cold-load phase was reached; there were zero requests because installation never started. The exact attempted test source, failed log, runtime evidence and invocation are preserved. A subsequent source-only correction uses the shipped pnpm schema's literal `null` for its proxy variables, retains empty legacy npm proxy values, records requested settings before any probe, and labels unverified network policy as requested. This correction has **not been rerun**, respecting the task's single-run/no-retry boundary. Effective pnpm 10/11 isolation and the bundled installation scenario remain unverified. `.work/preinstalled-pnpm11/RESULT.json` records the failure and remaining acceptance; it does not supersede the prior failed proof with a success claim.

Dependency installation, synthetic activation, browser UI acceptance, native application acceptance, real model behavior and teaching quality are separate phases. Native host UI/file chooser, real model/provider behavior and teacher acceptance remain untested. No existing installer archive was replaced; no real profile, credentials, model, LAN/production deployment, commit, push or private receipt was used.

## Parent final verification: bundled runtime passed

The parent reviewed the proxy correction and ran the unchanged assertions in a new `.work/preinstalled-parent-final/official` tree. **Node 24.18.1 / pnpm 11.7.0 passed** the full official scenario: expected old-layout 404; baseline installation and exact-candidate upgrade in both selected/unselected variants; zero corrected-layout registry requests; all ten old package trees, archives, relative sources, selection and component patches retained; corrupt upgrades rejected without losing manifest/lock/patch/module bytes; and separate fresh-process official Loader activation matching selection. The process used the verified application executable with `ELECTRON_RUN_AS_NODE=1`, never its desktop UI.

All three fixtures first passed effective-config assertions for empty isolated user/global config paths, workspace policy, store/cache/state paths, registry and bounded fetch settings. The source-prepared layout receives `autoInstallPeers:false` and `ignoreScripts:true` from generated `pnpm-workspace.yaml`; the fixture does not supply those two settings through env or .npmrc. The server stopped. Source hashes, exact invocation and results are under `.work/preinstalled-parent-final/`, and archived in the final artifact directory. The two preceding failed experiments remain intact and are superseded by this final result for the bundled-runtime scenario.

The official [pnpm migration guide](https://pnpm.io/migration) explains why pnpm 11 no longer reads general settings from .npmrc or npm_config_* variables. This fix applies to fresh build inputs only. Native UI, real models, used-Home migration, final offline-suite integration and real Hub approval remain separate and untested.


The default Homebrew Node25.8.1 / pnpm10.32.1 path also passed the final complete scenario under `.work/preinstalled-parent-pnpm10-final/`. An initial fixture expectation assumed its global config would equal `empty-global.npmrc`; the real safe-key probe instead reported the isolated XDG `pnpm/rc`. The test now creates that empty file and asserts its exact path, with the pnpm11 expectation unchanged. The initial diagnostic remains under `.work/preinstalled-parent-pnpm10/`; no installation occurred in that diagnostic run. These later parent verifications supersede CLI result files that accurately recorded their earlier single-run failures.
