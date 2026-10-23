# QCU-HUB-ADMIN-PASSWORD-UX

Deployment follow-up, parent owns remote effects. Only after QCU-HUB-MARKET-P15-ROLLOUT delegate completes, implement this bounded fix in the current worktree. No subagents, deploy, credentials, keys, commit or push. All shell prefixed rtk.

## Observed evidence
On actual mini Python and native Terminal the user twice saw `New password:` then only `startup.refused`, never `Repeat password:`. No real state directory was created. Parent ran the same transferred source in a disposable PTY with a synthetic 12+ character password: first/repeat prompts, state creation and server startup all succeeded. No actual password was read or requested. First-input validation currently calls password_bytes before repeat; it collapses invalid length/input into generic startup refusal. Need actionable non-secret feedback rather than asking the user to blindly retry.

## Minimal change
In hub/admin/server.py keep strict TTY-only getpass/no echoed fallback, fixed qcu-admin principal, 12-128 character /512 UTF8 byte/noNUL rules unchanged. For a rejected first password, print a clear fixed message describing rules (Chinese or short bilingual), without entered value, length, hashes or traceback, then allow re-entry. Repeat mismatch must print a fixed message and re-enter both values, never silently accept. EOF, KeyboardInterrupt and GetPassWarning must still abort safely before credential/state initialization. Non-auth startup failures retain bounded sanitized messages. No password CLI/env option or default; do not relax guards or log input.

Add narrow mocked prompt regression tests proving short/invalid first input cannot become credential state and retry works, mismatch retry works, EOF/TTY/no-echo safety remains. Reuse relevant existing admin22 tests; do not repeat unrelated market/browser suites. Leave concise result in .work/p15-rollout/admin-password-ux.json, note remote deployment pending, and exit. Parent transfers reviewed code, user enters password locally.

## Additional parent review correction before rollout
In market index.js `updatesRecovery()` currently returns JSON null before profile-scoped MarketUpdates exists. That can treat not-yet-ready durable journal recovery as no pending work, allowing CatalogRuntime refresh/direct mutation guard to proceed during startup. Use the existing updateService() readiness refusal for recovery too (do not invent no-journal state). Add a narrow official/shared startup test: before update service readiness, refresh and ordinary preparation cannot authorize a mutation; after readiness recovery works. This is a separate small correction, preserve completed integration sources and only recheck affected official/market suites.
