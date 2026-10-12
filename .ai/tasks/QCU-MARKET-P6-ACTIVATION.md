# QCU-MARKET-P6 user-approved activation amendment

The user explicitly selected one activation confirmation for single-component products in the parent thread on 2026-10-12. This supersedes the initial task's requirement for two human confirmations for those products. Installation consent remains separate. Multi-component packages must continue to require explicit component choices; do not infer components.

Implement one reviewed `activate` operation for this catalog's one-Skill/one-row products:

- UI: `查看启用确认` -> review clearly states it covers enabling this exact bundle and its one exact component, then `确认启用`. Do not silently chain from installation to activation. Display both actions and their user-privilege/profile effects in the confirmation.
- Snapshot binds catalog fingerprint, exact release identity and current inventory. Check matching Host version and inventory before any mutation; reject changed bundle version, stale confirmation, wrong/multiple component rows, transport change, and different installed content identity according to existing guarantees.
- If installed-disabled, enable bundle using official API. Inspect result and refresh rows. If bundle enable already activated the single row, verify it and do not send a duplicate row enable. If exactly one expected disabled row remains, enable its exact entryId, then refresh/verify. If bundle was already enabled, permit confirming exact row enable alone.
- Stop on failed/unknown/overridden/restart-required outcome. Never continue activation after a restart-required bundle result or reply loss. Keep partial state visible and require new informed confirmation to resume later. No auto rollback, auto restart or retry.
- Respect cross-entry serialization for the ENTIRE compound activation. Returning while not yet mutated revokes consent; leaving while bundle enable is in flight must prevent any late component enable from using stale UI authority. Connection reset/disposal likewise prevents the second mutation. Do not claim already-sent mutation was cancelled. Persist actual status and reconcile through read-only inventory; avoid duplicate enable after uncertain reply.
- Keep existing low-level reviewEnable/confirmEnable compatibility if needed for old tests, but single-product UI uses the new explicit compound operation. Do not loosen existing manager codec or trust checks.
- Add meaningful tests for official bundle-enable that activates rows automatically, separate row enable when needed, wrong/multiple rows, partial/restart/unknown results, duplicate click, cross-entry lock, connection reset and leave/unmount in-flight. Browser fixture must exercise correct one-confirmation UI on multiple entries and installation disabled.

Do not alter already deployed P5.1/coach P2 or any immutable archive. If P6 package has already been packed before this amendment, preserve it as an interim artifact and use a distinct final build directory or new market version for changed bytes; final docs/manifest must name exactly one reviewed installation candidate. No deployment or permissions changes.

## Parent review follow-up
- Remove full Skill instruction bodies from catalog-input/bundled catalog/client and detail UI. Catalog contains bounded purpose/examples/provenance/digests only; actual instructions remain in downloaded Skill archives. Update tests accordingly, preserve exact source/archive integrity.
- Use market version 0.1.0-pilot.6.1 and new artifact root $HOME/Artifacts/qcu-harness/0.1.0-pilot.6.1. Preserve all prior 0.1.0-pilot.6 artifacts. Five Skill versions/hashes must remain unchanged unless substantive Skill corrections are separately reported.
- Review the new static provider and product source for correctness; no new deps, no deployment/commit/push. Run meaningful tests, report network/browser sandbox limits, hand off commands. Do not wait for absent mini permissions.


## Implementation handoff — 2026-10-12

Implemented the source amendment and parent follow-up in this worktree. See `docs/qcu-market-p6-source.md` for the exact single reviewed pilot.6.1 candidate, current reproduction commands, 156 passing source/non-network tests, 18 passing extracted-archive official tests, unchanged Skill hashes and preserved prior artifacts. The new 47-case activation suite and scoped official tests cover compound enable, lifecycle revocation and unresolved outcomes. HTTP/browser acceptance remains deferred because this sandbox denies loopback bind (`listen EPERM`); Chromium did not launch. No deployment, dependency install, actual-profile installation, commit, push or agents.
