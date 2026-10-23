# QCU-PREINSTALLED-BUNDLED-RUNTIME

User delegates autonomous expert hardening and validation. Read AGENTS context. Scope ONLY tests/qcu-preinstalled-official.test.mjs and docs/qcu-preinstalled-local-sources.md. No nested agents, receipts, Git writes, package/runtime/build changes, GUI, real profiles/keys/models, LAN or production writes.

Material discrepancy: official proof used Homebrew pnpm10.32.1 / Node25.8.1, while actual frozen rc3 app ships Node24.18.1 and pnpm11.7.0. Add minimal explicit test-only env override for pnpm command/args. Capture before test clears inherited env. Enable ELECTRON_RUN_AS_NODE=1 only for the override and preserve it in clean child env when using Electron CLI, including cold process. Record actual executable/arguments, Node and pnpm versions in evidence. Defaults retain old command. Validate args are a JSON string array. Use env names QCU_PREINSTALLED_PNPM_COMMAND / QCU_PREINSTALLED_PNPM_ARGS and QCU_PREINSTALLED_ELECTRON_NODE=1. Do not weaken any install, zero-registry, config/module parity, rollback or cold-load assertions. New output must be fresh; prepared input .work/preinstalled-boundary/prepared-profile. Update docs truthfully from results.

Parent verified actual application executables against frozen rc3 ZIP. Public paths:
exe /Users/mcq/Applications/QCU助手.app/Contents/Resources/program/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness
pnpm /Users/mcq/Applications/QCU助手.app/Contents/Resources/program/DeepSeek Harness.app/Contents/Resources/runtime/pnpm/bin/pnpm.mjs
SDK /Users/mcq/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source
Read baseline exact path from .work/preinstalled-boundary/OFFICIAL-INVOCATION.json (public frozen TGZ). Use QCU_PREINSTALLED_OUT=.work/preinstalled-bundled-runtime/official. Run test once with actual app exe as Node AND pnpm command, args JSON [pnpm.mjs], ELECTRON_RUN_AS_NODE=1 and QCU_PREINSTALLED_ELECTRON_NODE=1. Use audited SDK flags from prior invocation. Explicitly use require_escalated if sandbox denies loopback; preserve diagnostic. No general network dependencies; registry loopback404 only. Do not launch actual GUI. If pnpm11 mismatch fails, preserve evidence and report; no broad fix.

Write .work/preinstalled-bundled-runtime/RESULT.json with source hashes, environment versions, actual test counts/results, exact frozen package SHA4db68f807362f243f77039d66c09b1981a4b61a93185f37c43731ea001a96581 unchanged, no model/native/Hub acceptance claim. Result status for parent review. No other suites needed.
