# QCU-READING-R1A

Parent task: qcu-standalone-learning-tools-20261029. Read docs/qcu-standalone-learning-plan.md before implementation.

Implement the first usable slice of a standalone teacher document reader, as a NEW DSH plugin qcu-reading@0.1.0-pilot.1. You are the Codex implementation worker required by /Users/mcq/Repos/AGENTS.md. Parent owns review and delivery. Use rtk-prefixed commands. Do not spawn additional agents or nested codex jobs. Do not commit, push, deploy, access mini, open installed apps, read credentials or personal files, or modify existing plugins/upstream. No external model calls or new dependencies. Use only self-authored fixtures. Do not start a new daily-report or memory task; report evidence and pending work to parent.

## Allowed scope

- hub/plugins/qcu-reading/**, tests/qcu-reading*.test.mjs, tests/fixtures/qcu-reading*, docs/qcu-reading-r1a.md; a small README entry linking this candidate and the already-created plan is allowed.
- Do not edit docs/qcu-standalone-learning-plan.md or this task except to report accurate status if necessary; parent owns them.
- .work artifacts in this worktree or the parent-approved artifact directory; no credentials, big dependencies or generated browser profiles in Git. Existing plugins/upstream are reference-only.

## Product

Full host/client plugin patterned on qcu-expert-teams with official Cordis/Typert remote mount and shared React lazy-CJS client. Reuse DSH default model via official llm/agentDefaultModel services, not credentials. A separate browser preview must run the SAME UI/controller/store with an explicitly synthetic generator, not hardcoded pretend success pages.

R1a supports only UTF-8 .txt and .md files, plus clearly labelled pasted text import if helpful. Show supported formats in UI. Unsupported PDF/DOCX must explicitly say planned, never treat them as text or claim support. Browser-selected bytes decoded with TextDecoder fatal UTF-8; bounded file size, name and content validated on host. No HTML rendering or execution from imported files/model output; render text safely. No path chosen by the client is ever opened on host; selected content is passed as data.

Persist snapshots in workspace .qcu-reading using safe bounded local storage (follow existing expert store safe IO). Stable content-hash document identities and paragraph locators; importing identical content must not duplicate, same name with different content remains distinguishable. Workspace resolved only by workspaceRegistry. Do not follow symlink store paths. Do not create or read stores outside the selected valid workspace. No original user file mutations. Keep reasonable hard capacity limits and helpful errors; do not add destructive cleanup in this slice.

Reader: compact materials list, plain original text with stable paragraph locators; clicking a hit/citation visibly selects and scrolls to that paragraph. Deterministic Chinese-capable keyword matching (explain limitations); no hidden model calls or automatic network. Save a selected excerpt as a local note, persisted over refresh. An evidence miss says no matching source; does not send a model call claiming material support.

Question lifecycle: preparing retrieves a small bounded set of actual source paragraphs. Confirmation shows exact selected model/provider/policy, question and full snippets that will be sent. No auto-call on navigation/import/open/search/prepare. Explicit per-request checkbox/button to send; bind confirmation to immutable document/evidence/question/model snapshot. Start verifies model still matches, idempotent request replay cannot double-call, stale confirmation rejected. Max one active call per workspace; cancellation/plugin dispose/timeout stops and never auto-retries. Persist state BEFORE paid call and terminal status afterwards; reopening pending records marks them interrupted with no retry. Match upstream model adapter API, use low/off reasoning where supported, bounded output and no tools. A max-tokens/abnormal finish is failure, not accepted complete output. Do not include all document text when only snippets are confirmed. Treat user materials as untrusted data, never instructions.

Responses can use [S1] etc. Only references that exist in the confirmed snapshot become clickable. Unknown references and answers missing citations must be labelled as needing source review, not falsely verified; don't claim citation validity proves correctness. Keep immutable source snippets and locator mapping in the answer history so old answers stay traceable. Export Markdown with document identity/version, question, exact source snippets, model/status and answer labelled as teacher-review draft. Partial/failed records remain visibly incomplete. No model calls on export.

UI: follow the design plan. DSH font variable (--dsh-content-font-size), inherited font family, dark/light theme including explicit data-theme, 360px narrow panel with original/QA switching, safe long filenames/text, keyboard focus and usable confirmation cancellation. No icon-heavy giant cards, no marketing hero, no diagnostic wall. Buttons in Chinese, consistent names. Give a meaningful empty state. Technical details collapsed. Do not import fonts/CDNs or add analytics. Use the existing plugin slot/sidebar/lifecycle pattern.

## Tests and package

Write meaningful Node tests for actual IO, source mapping, input validation, adversarial input, workspace isolation, duplicate behavior, stale route/document/question confirmation, no-hit 0 calls, cancellation, interrupted reopen, max-token failure and provenance/export. Official runtime tests using the existing qcu-expert-teams-official pattern if dependencies can be resolved. Browser test/preview with real UI and synthetic model must support parent execution. Prefer env paths QCU_OFFICIAL_DEPENDENCIES and QCU_BROWSER_DEPENDENCIES; don't install dependencies or hardcode private credentials. Include build.mjs, package metadata, cordis patch, README and deterministic pack.py similar to existing plugin. Build generated client.js and include it. Need exact pinned DSH0.2.0-rc.2/Cordis4.0.4 peers. No Hub catalog inclusion yet.

Locate reference dependencies via existing paths only when actually present. Parent can supply a path after inspecting; don't spend the whole task hunting. Use .work output if no external writable path. Provide an implementation report listing files, commands/results, remaining verification and factual limitations (TXT/MD first slice; no PDF/DOCX/OCR yet; synthetic model != real/native).

Do complete implementation and run narrow relevant tests, not just a plan. Keep edits simple, scoped, readable JavaScript. Before ending, build the actual client and provide parent a command to launch preview. Parent will review, run broader verification, capture screenshots, package and handle Git.
