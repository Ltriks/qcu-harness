# QCU-COURSE-REVIEW-STABILITY — 2026-10-20

User authorized continuing first-use reliability and complete draft editing. Parent owns final review, delivery and commits. Prefix shell commands with rtk.

Workspace: /Users/mcq/Repos/worktrees/qcu-harness/course-workbench, dev/qcu-course-workbench, base 5b8ae5a36a579c1756a89cf8baa32f6fcbfc6594. Own worktree was clean and remote fetched at start. Do not modify other worktrees: .work/market-network-fallback and .work/market-update-v14 contain concurrent uncommitted work. Main README.md is user-dirty. No agents/delegation. No commit/push/deploy, no mini/Hub changes, no model calls, no credentials, no official DSH changes, no TS migration.

Read docs/qcu-course1.2-native-acceptance.md, existing controller/view/Host/protocol/prompt/export and tests before implementing. Reuse JS+React and exact DSH rc2 public APIs. Dependency root for tests: /Users/mcq/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source (QCU_OFFICIAL_DEPENDENCIES).

Observed live evidence, NOT yet proven causes:
- Course1.2 initial UI shows connection/generation-timeout even before generation; workspace list exists; choosing existing default-workspace clears error and loads history. Clicking reconnect alone did not immediately help.
- Market13.2 cards changed pending check -> operation incomplete on page entry. Source current view does NOT explicitly auto-check all flows. Investigate true local lifecycle/call cause; do not invent a diagnosis or merely rename an installation failure.
- One actual deepseek-flash low/12000 generation succeeded in42.016s. Never repeat that call. Both old failure histories must remain.
- Generated content has denominator mistranslation, ambiguous signed-vs-positive decrease formula, G/Q ID mismatch; synthetic topic low reasoning was echoed. Structural pass cannot guarantee semantics.
- Existing editor covers only lesson intentions/criteria/vocabulary and section bodies, not title, sequence, quiz answers/options/explanations; split('\n') also destroys bilingual list-item boundaries.

Deliver minimal robust scoped changes:
1. First-use boot:
   - Inspect/replicate using delayed, failed, overlapping boot/reconnect and workspace selection scenarios.
   - Workspace list/selection must remain usable without waiting for slow or unavailable MODEL capability metadata. Model route policy separately unavailable/loading may disable generation, never block existing draft browsing/revision/export.
   - Distinguish connecting, choose workspace, missing model/policy, real network/transport failure and generation unknown. No false generation timeout if no generation was sent.
   - Fence stale concurrent boot replies, connection reset, workspace/course selection and disposal. Late boot failures must not overwrite current task/selection/phase or restore consent.
   - No automatic generation/retry; bounded read-only lookups only, appropriate cancellation cleanup. Keep exact route/policy/budget consent and prepared-call checks.
   - If wire contract changes bump course PROTOCOL as needed, candidate VERSION/package to0.1.0-pilot.1.3, preserve v1 stored tasks including historical failures.
2. Market status:
   - Investigate official service initialization/read-only checking. Add focused real public-API/harness proof of any cause found. Separate read-only inventory status checking from install/enable mutations and their serial approval guards as needed; concurrent read-only checks must not manufacture peer-operation errors or clobber install/activation confirmations.
   - Use truthful checking/unavailable/unknown states. Don't show uninstalled/loaded or hide genuine failures without proof. Navigation must never initiate install/enable/prepare/download.
   - Keep fingerprints, SHA checks, all approvals/cancel semantics, exact inventory/version conflicts. Preserve unified scenes+version-management UI, no merge/copy from concurrent branches. No update/publish/upload feature implementation in market.
   - If root cause can't be safely proven offline document limitation precisely, improve only verified lifecycle defects. No broad speculative refactor.
3. Complete draft editor:
   - Edit lesson title; intentions/criteria/vocabulary item-by-item preserving internal newlines; sequence phase title/minutes/teacher/student/evidence; component title/section heading/body; quiz question/four options/correct answer/explanation.
   - Use compact labelled sections/details, readable English/Chinese, dark/light and360px, no JSON textarea as teacher UX. Follow current visual system, no new dependencies.
   - Existing component IDs, selected components and question/phase count remain intact unless specifically supported by existing contract. Preserve exact parseDraft validation, 45min sum and answer bounds. Invalid local edits show actionable message, cannot be saved/applied, never call model.
   - Local preview updates, Apply edits validates/persists revision and changes hash, Discard restores committed draft. Save disabled while edits pending. Clear/invalidate stale save confirmation immediately after local edits/task/component/workspace changes; UNKNOWN sent save requires original reconciliation, don't lose its saveRequest or auto repeat.
   - Pending local edits across component tabs should be preserved or explicitly handled, not silently dropped. Empty/invalid numeric input can be edited without forced unwanted conversion.
   - Historical tasks and already exported files remain untouched until explicit normal UI actions.
4. Prompt modest corrections:
   - Require accurate bilingual definitions, consistent formula sign/magnitude and within-component/sequence question IDs. Each export standalone with full concise key. Do not hardcode percentage-specific canned answers or build unverifiable automatic semantic certification.
   - Keep selected-only length bounds, exact12000budget, low/off/default, no clipping, no retry. Use neutral synthetic teaching topic in new fixture/demo; do not rewrite prior live evidence.
5. Tests and real preview:
   - Meaningful targeted controller/Host/official lifecycle and editor integration tests including negative inputs, stale callbacks, no side effects, consent invalidation and original-save reconciliation.
   - Update preview/fixture as needed to render real shared UI using synthetic generator only; actual React browser exercise edit phase/quiz, bilingual item preservation, apply/discard, hash/save invalidation, browser no console errors. Run current related source/official/client/export regressions. Use existing Python for OOXML checks.
   - Rebuild tracked course and market Client if source changed. Don't overwrite any immutable release archives or release metadata/catalog pins. Any changed package is local candidate not deployed. Do not create new TGZ in old artifact dirs.
6. Documentation:
   - Add docs/qcu-course-review-stability.md with proven root causes, implementation, tests and failures/untested. Correct outdated README's pending-v1.2 statement by link to prior live evidence, clearly mark1.3localcandidate. Do not claim mini1.3 or Office verified.
   - Parent separately writes Hub submission workflow plan; don't implement upload/admin network service this turn.

Execute implementation + focused validation now. Return concise changed files, exact test results, unresolved failures, preview start command, candidate protocol/version and known limits. If any command is denied use normal approval flow; no bypass flags. Stop if concurrent changes to own files detected and report.
