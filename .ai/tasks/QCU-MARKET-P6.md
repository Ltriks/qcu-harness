# QCU-MARKET-P6 — skills delivery and teaching catalog

Implement only the P6 source and isolated-test stage of the user-approved roadmap. Parent is completing live coach acceptance and owns all mini/Hub interactions. Repository-wide AGENTS asks for a written task and Codex implementation in an independent worktree; this is that task. Do not spawn further agents.

## Starting point and boundaries

- Base commit 153170ea35a30e1de6d59ccaf3898d11e662fd19, parent branch dev/qcu-market-prototype.
- Work ONLY in this market-skills worktree on dev/qcu-market-p6. Do not modify the parent's market-ui worktree or main.
- JS + React. No JS to TS migration, no official DSH source edits, no dependency downloads, no credentials or personal documents.
- Fixed official DSH 0.2.0-rc.2; existing audited local dependencies at $HOME/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source. Use rtk for shell commands.
- Artifacts only under $HOME/Artifacts/qcu-harness/0.1.0-pilot.6/; disposable fixtures under this worktree .work/. Never overwrite an existing different-byte archive. Existing P5.1/coach P2 packages unchanged.
- No mini/Hub deployment, no install into actual profiles, no git commit/push: parent will review, validate and integrate.

## Deliverable

Create real, independently installable teaching Skill products for five existing canonical sources:

1. skills/qcu-lesson-planning/SKILL.md — lesson planning
2. skills/qcu-tiered-practice/SKILL.md — differentiated practice
3. skills/qcu-note-organizer/SKILL.md — notes
4. skills/qcu-reading-outline/SKILL.md — reading outline
5. skills/qcu-integrity-guard/SKILL.md — citation/integrity checks

These are currently drafts: improve their instructions to be useful for teachers with clear input, steps, output, synthetic example and limits. Keep source/license attribution, don't use real student data or claim teaching outcomes were tested. Preserve existing canonical qcu names. One product = one skill = one DSH bundle id, so current independent bundle/row consent and exact inventory matching remain applicable. The existing study coach stays in the plugin category and its exact immutable P2 release entry stays unchanged.

## Mechanism

- Use a shared minimal provider template to register a fixed embedded Skill with ctx.skills only after explicit activation. Verify embedded content SHA256 before registration; fail on an existing same-name skill, and use Cordis-owned disposal. No network, tools, sessions, file reads or automatic model calls in provider runtime. Source source bundle needs no arbitrary runtime loader.
- Implement reproducible build/pack for the five individual bundles: exact peer versions, no dependencies/install scripts/build permissions, default bundle row disabled with config.enabled=true, include LICENSE and SKILL.md and compiled content. Include only explicit allowlisted resources, never glob secrets. Deterministic gzip/tar, exact size/SHA and qcu id/version/hash immutable filenames, refuse collisions. New skill products version 0.1.0-pilot.1; market version 0.1.0-pilot.6.
- Reuse official installBundle/enable paths; do not invent a separate filesystem installer or change the app sandbox.
- Evolve frozen reviewed catalog as needed (new schema/protocol version explicitly paired with Host/Client). Separate product kind skill vs bundle from the fact both deliver DSH TGZ bundles. Keep strict limits/identity/origin (192.168.1.68:8080)/hash and no arbitrary URLs/commands or remote self-trust. Catalog generated from one reviewed source input and release records, not network.
- Add explicit provenance metadata sufficient for future reviewed third-party adaptations: actual author/upstream source/pinned revision/license/modification statement. Source labels must agree with provenance. Never label external content QCU-owned; do not trust metadata as an install permission. Third-party products are NOT added during this task.
- Skills category now shows only actual packaged Skills; plugins shows existing coach. Cards/details use correct labels, icons from existing scene mapping, and per-entry flow. Generalize preview fixture for multiple products, so each installed state/activation is isolated. No navigation RPC/mutations, default diagnostics folded, preserve search/category/back focus, declined reviews, cancellation, unknown-outcome block, catalog-bound confirmation and serial install lock.
- Remove coach-specific runtime descriptions from generic Skill confirmations/permissions; explain accurately that these products register static instructions. Existing coach wording may remain for its card only.

## Tests and acceptance

- Update existing market tests meaningfully for real six-entry catalog; preserve legacy security, expired/cancel, remote metadata, same-version/different-hash, scoped Cordis and real HTTP coverage. Do not delete or weaken assertions just to pass.
- Build/source integrity and official Cordis registration/disposal for each new packaged Skill. Verify disabled registers nothing, changed content refuses, duplicate refuses and unrelated entries remain after disposal. Existing five-source licensing remains valid.
- Browser tests: both categories and search, actual content, second-entry independence, cross-entry confirmation lock, returning revokes review, install stays disabled, separate bundle/row consent, no network/React errors and narrow light/dark rendering. Preview unmistakably synthetic.
- Use existing official dependency tree; prepare HTTP fixtures from new market archive, old P2 market at $HOME/Artifacts/qcu-harness/0.1.0-pilot.2/market/qcu-market-0.1.0-pilot.2.tgz and coach at $HOME/Artifacts/qcu-harness/0.1.0-pilot.2/coach/qcu-study-coach-0.1.0-pilot.2-4ac9b2489ece90098faea5f5d0cf79c6efb2989214eaf74f4e38c4841c2eb060.tgz.
- Official ASAR already on disk: $HOME/Documents/Codex/2026-09-30/task-7/official-desktop-csv-pilot/application/DeepSeek Harness.app/Contents/Resources/app.asar. Never inspect real profile credentials or logs.
- If loopback/Chromium is denied in child sandbox, run all non-network checks and report exact deferred commands. Parent handles scoped execution approval; don't broaden sandbox or use bypass flags.
- Document actual implemented/tested vs live untested and provenance. Stable paths in README use $HOME, no personal absolute paths in tracked files.

Return changed-file summary, test results, final artifact hashes, limits and commands needed by parent. Stop when P6 source deliverable is ready for review.
