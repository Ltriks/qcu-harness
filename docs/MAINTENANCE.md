# Maintenance map for the QCU Office candidate

This version retains the official external business bundle and adds a fixed QCU Office entry with launch-owned policy. The previous candidate's explicit-unload policy defect is fixed only on this combined supported path. Standalone installation in ordinary DSH remains an unprotected negative control. See [POLICY-LIFETIME.md](POLICY-LIFETIME.md) for the current contract, maintenance scenarios, and limits.

## Public upstream changes

The cumulative patch changes 16 production source files, +1403/-7 against fixed commit 639ed015397290b3745d163aafe02ffee4aa3f84. Seven existing production files account for +90/-7; nine new fixed modules account for +1313. Build/package metadata, documentation and tests are counted separately in MANIFEST.json. The old embedded candidate changed 36 production files, including 21 existing files; moving business code into the external bundle does not make that code disappear.

The previous thin candidate had eight production source changes, +1027/-4. The additional source work establishes a fixed entry, persistent-in-process policy, and last-applied launch restrictions; it does not introduce a generic provider/permission registry or modify the model, SessionWorkspace, or Tools execution kernel.

- External package: business engine, local service owner, original two tools, Skill, Client contribution, private native publisher
- Desktop entry/main/preload: fixed launch identity, private namespace, native wiring, no ordinary-updater replacement
- Desktop Host: pre-entry policy and fixed 28-row restrictions
- CLI profile boot: trusted launcher preparation and restriction inputs
- app-boot profile context: retained launcher rows and hard target/schema validation during initial composition and official reconciliation

## Working rules

Use the official bundle/Client/Skill mechanism for business changes. A new tool name, model-data purpose, local path, native operation or forbidden module requires a separate explicit policy review. A business package cannot grant itself broader permissions. Keep matched protocol definitions and their parity tests together. Eight resource hashes retain candidate bytes; three legacy web hashes are deliberately revised by the recorded Mac feedback merge. Review further resource changes explicitly.

For unavailable behavior, inspect discovery/configuration, dedicated entry identity, pre-entry policy, owned Python readiness, private child/generation binding, then native occurrence lifecycle. Never replace a failed stage with a generic browser, raw renderer target, dynamic runner, ordinary profile, or unrestricted shell.

For DSH upgrades, use a separate fixed checkout and synthetic home, review the public bootstrap and Cordis lifecycle contracts, rebuild every changed Host dependency, rerun negative controls and actual Loader/HMR/IPC fixtures, then separately validate native behavior. Keep ordinary updater replacement disabled until a qualified QCU distribution path exists. Retained source/hash history is not automatic data rollback.

## Remaining limits

No new native GUI acceptance, real browser storage-erasure certification, Mac installation/coexistence, Windows ACL validation, signing, qualified update feed, or stable-profile migration is established. Abrupt Host death may orphan Python; the preserved service has no parent-death watchdog. Private data must not be recovered by killing an arbitrary PID from a stale record. Arbitrary same-privilege Node code is not sandboxed. The old Mac feedback files are reconciled in this repository; their new native visual acceptance and legacy conversation-authorization revocation remain unfinished. Hashes and logs provide reproducibility, not tamper-proof runtime audit.
