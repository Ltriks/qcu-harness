# QCU-SUITE-INTEGRATION-B parent review

The rc4 candidate is in `.work/suite-integration-b/rc4/`; the compact evidence index is `.work/suite-integration-b/RESULT.json`. This is a local candidate, with native execution acceptance still pending. Nothing was committed, pushed, published, installed into a real Home, or sent to a model.

- Course `0.1.0-pilot.1.3`: all 13 archive members match the supplied source and commit `7e647436f0849be617b360add1cd771d47fa8339`. Catalog provenance and local history now include 1.3, preserving 1.2 and its candidate status.
- Signed update projections: legacy uses `pilot`; v2 uses `pilot-experts`. The new parser admits the second channel only with the reviewed expert-capable product policy. Host checks the signed channel against the selected URL before saving state. Only a genuine v2 404 permits legacy fallback. Tests reproduce both prior substitutions, then reject them; frozen legacy parsing and the shared sequence floor remain covered.
- The final market 15.2 SHA-named candidate supersedes the unpublished stage-A `f94e…c328` artifact. The original artifact is unchanged. Expert source/archive and the six-file branding 0.2.1 build remain frozen.
- rc4 has 11 teaching packages plus branding, twelve relative `.qcu-bundles` sources, the existing two-field pnpm policy, CLI 1.0.84 bytes, and its own default Home. Bootstrap invokes no package manager. Repeat preparation validates receipts, module/source inventories, dependency declarations, bundle/component selections and policy without repairing unknown data. Later dependency or managed-version changes require a reviewed suite/receipt update before this frozen-suite launch gate accepts them.

The builder checks `release/integrated-teacher-macos.json`, extracts the pinned r3 ZIP with `ditto`, and reuses its native binaries, licenses and original guide. Only the existing frozen updater patch is applied to the vendor ASAR. The expected ASAR is `759bf095f7e4e6b97380f6103a9a6b8c34fc980c4b7b9b34bd1c1cf1f8ed0583`. All other vendor bytes, modes and links match; the main executable matches after stripping signing metadata from disposable comparison copies. Inner and outer signatures are ad hoc, without Developer ID or notarization. The original first-read text is preserved as `原版rc3说明.txt`; the new `先读我.txt`, README and short HTML describe rc4 correctly.

The actual ZIP is extracted into a Chinese/space path, compared with the candidate inventory, and checked with strict inner/outer signature validation. SDK-backed first/repeat/moved-app JavaScript preparation preserves synthetic settings and work. The network/child-process guard covers all twelve actual ZIP modules, seven sealed teaching instructions, the course Skill, three services, ASAR profile metadata, actual ASAR SlotRegistry/Client SSR and managed-updater behavior. Navigation clicks only select registered panels. A signed local feed source-verifies all eleven teaching modules and keeps course 1.3 current.

Official PluginManager with the existing SDK pnpm **11.7.0** performs real local installation and upgrade of an additional synthetic bundle on a copy of the prepared profile. All twelve original relative sources, module bytes, settings and enable choices survive; a corrupt operation preserves manifest, lock, patch and modules. Empty configs/auth files, isolated store/cache/state and effective policy probes are recorded; the loopback 404 registry receives zero requests. The SDK pnpm entry is byte-identical to the shipped 11.7.0 entry. This is separate from execution of the copied native pnpm helpers.

## Native execution boundary

The copied native launcher stalled before user code at `_dyld_start`; the extraction has quarantine tags. Removing that tag from an early disposable test extraction returned EPERM. The distributed ZIP and real environments were unchanged. The copied ASAR native loader and copied pnpm native helpers also stalled. These observations indicate a local native execution/approval boundary; they do not establish native application acceptance.

Tests therefore explicitly use the hash-pinned, already available Electron 44 / Node 24.18.1 SDK runtime and trusted SDK dependencies. Full native `--prepare-only`, native CLI execution, ASAR native resolution and the ZIP-bundled pnpm helper execution remain pending parent-authorized local verification. Native GUI, real models, teacher acceptance, Windows and production also remain unaccepted. Ordinary updater check/download/install calls are disabled and minimum-version policy remains intact; the frozen updater's existing rc3 wording was intentionally not changed.

After the parent handles native execution authorization, rerun with a fresh disposable output and no runtime override:

```sh
rtk proxy python3 scripts/verify-integrated-teacher-macos.py \
  --archive .work/suite-integration-b/rc4/QCU-Teacher-0.1.0-rc.4-mac-arm64.zip \
  --out .work/suite-integration-b/parent-native-verification
```

The verifier always supplies synthetic `QCU_TEACHER_TEST_HOME`; it never uses the default teacher Home. The optional `--validation-runtime` accepts only the exact checked SDK executable and explicitly reports native acceptance as pending.

## Maintainer-only migration contract

`scripts/migrate-teacher-home.py` (also included under APP `support/`) implements preview and digest-confirmed apply. It is never called automatically by the launcher. This task applied it only to disposable fixtures.

- Supported source: exact rc3 receipt seed `970260c6565d2adc5c886c95a5713aeb2b8b1dac334298d5ba1993809f721789`, the nine frozen teaching packages and branding 0.1.0, with matching installed bytes. Unknown dependencies, module additions, additional profiles or unsupported base configuration are refused.
- The plan binds the complete included source fingerprint, target, seed and validation-runtime identity. Preview writes no target. Apply rechecks the digest, stopped-instance state, source and target before copying and before commit. Source symlinks, hardlinks, special files, overlap and occupied/partial targets are refused. Descriptor-relative no-follow reads protect the opaque copy. Darwin exclusive rename cannot replace even an empty target created concurrently; failure removes only the transaction's staging directory.
- Persistent settings, workspace contents and opaque files remain local; values are not logged. Electron caches and process locks are excluded. Only pinned managed packages and their controlled declarations are replaced. Existing bundle selections, component choices and unrelated settings survive. New market/expert packages stay unselected and disabled until separate enable confirmation.
- The managed CLI path is rebound only when it exactly referenced the old managed CLI. User workspace absolute paths are never rewritten or copied from outside the source Home. Detected absolute workspace references are counted as pending; opaque file contents remain uninterpreted, so their external references require maintainer review.
- Twelve tests cover successful copy, preview cancellation, fake credentials/settings preservation, stale/digest/source-change refusal, running source, unsafe entries, unknown additions, occupied/linked/overlapping targets, exclusive target races, Mac case-alias overlap and rollback. Source content remains unchanged except a deliberately injected concurrent-user-edit fixture.

For a future specifically authorized migration, create a preview with explicit source/new target and `--preview-file`; review it, then use `apply --confirm-digest` with that exact digest. Use a fresh target and preserve the source. `QCU_TEACHER_VALIDATION_RUNTIME` is an explicit maintainer test override restricted to the checked SDK runtime, not a teacher setting. No real Home was previewed or migrated here.

Offline deployment materials are under `.work/suite-integration-b/operator/`: fourteen pinned current/history archives, catalog, non-runnable review-required job template and deployment plan. Publisher revision/time, real-key signing and deployment require later parent review and authorization; no production key or Hub was accessed.
