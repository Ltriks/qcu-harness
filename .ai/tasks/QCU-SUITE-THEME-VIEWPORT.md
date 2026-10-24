# QCU-SUITE-THEME-VIEWPORT: fix actual sidebar collapse regression
User requests autonomous completion before requiring teacher acceptance. Work only THIS isolated worktree; original suite-integration and its builder are concurrently running and MUST remain read-only. No nested agents, Git writes/commits, private receipts, real Homes, credentials/models/network except loopback, GUI/VM, app rebuilds. Narrow source scope tools/teacher-branding/src/theme.mjs, tools/teacher-branding/package.json, scripts/build-teacher-theme.mjs ONLY if needed, one focused new browser test and brief docs. No unrelated redesign/dependencies.

Parent reproduced on actual built branding0.2.1 using real React and a synthetic Host/sidebar slot fixture:
.work/parent-proof/RESULT.json and screenshots. At heights900/700/600/480px width1024, six normal nav rows push .qcu-side-work height to0 at <=700. Actual '添加工作文件夹' clicks timeout. Footer becomes tiny too. This cannot ship. Frozen Cua native tool took2996sec despite timeout; do NOT invoke it. Parent browser fixture source is .work/parent-proof/parent-theme-visual.mjs. It bundles exact generated client and uses trusted installed SDK + isolated sandboxed Playwright; adapt into a useful repo test, don't fake a component or force clicks.

Implement minimal existing-style layout fix so workspace/add folder, market/expert normal nav, help/settings/about and collapse remain reachable at 900/700/600/480 heights; use sensible scrolling rather than clipping/zero-height workspace. Preserve dark/light, normal/large fonts, collapsed sidebar, existing workspace native slot, current back navigation, managed update policy and minimum-version behavior. No navigation may create/send session, call model or install. Don't change business responsibilities or add protocol.
Bump only branding to0.2.2; existing independent r4 output/archives untouched. Build generated package in NEW .work/theme-viewport/package (6 files as existing builder). Keep0.2.1 frozen evidence.
Actual browser regression must demonstrate pre-fix failure from supplied evidence or current source once; then pass wide/collapsed, low-height, normal/large font and dark/light variants. Controls may scroll normally into view; don't use forced clicks or injected CSS to hide regression. Assert workspace viewport nonzero and buttons reachable/clickable, no horizontal spill and no install/session/model side effects. Capture representative 900/700/480 and collapsed screenshots, actual generated-client hashes. Use supplied installed headless browser sandbox on, no disable-security flags; stop all local servers/contexts.

Trusted SDK /Users/mcq/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source.
Chromium /Users/mcq/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell.
Task20 copied source files are pinned in .work/parent-proof/SOURCE-SNAPSHOT.json.
Run narrow theme tests + new browser; do not rerun expert/market suites.
Write compact .work/theme-viewport/RESULT.json with exact changed paths/hashes, before/final evidence, actual test counts and package manifest/hash. No full app, no native/model acceptance claim. Parent will import reviewed changes into suite-integration and rebuild final app. Finish once narrow checks pass.

## Completed in isolated worktree

- Sidebar scrolls vertically when space is short. Workspace keeps a 144px minimum viewport; footer and collapse button retain their height. The collapsed rail fits even when the vertical scrollbar consumes width, with the settings label still accessible.
- Branding is 0.2.2. The builder derives the generated About label from the package version; suite/kernel versions and managed-update/minimum-version code are unchanged.
- New regression: `tests/teacher-theme-viewport-browser.test.mjs`, adapted from the supplied fixture. It loads the exact generated client with real React in sandboxed headless Chromium, with synthetic Host/workspace/settings slots. It clicks navigation, native-slot add/settings controls, maintenance and collapse/expand; returns home through the existing header; checks geometry, both palettes/font sizes, accessible settings, horizontal overflow and forbidden effects. Free conversation uses trial hit testing because activating it intentionally starts a session.
- Before: freshly generated 0.2.1 fails at 1024×700 with a zero-height workspace and an actual add-folder click timeout. Evidence is preserved in `.work/theme-viewport/before-browser/RESULT.json`; supplied `.work/parent-proof/` remains frozen.
- Final: **38/38 pass** (6 existing theme checks + 32 browser cases: heights 900/700/600/480 × light/dark × normal/large × wide/collapsed). Browser captures include workspace/footer scroll positions at 480px. No external requests, session/model/install effects or browser errors were observed. Browser contexts/server closed and disposable profiles removed.
- Reproduce from this worktree (uses the trusted installed SDK/browser paths from the task; optional overrides: `QCU_OFFICIAL_DEPENDENCIES`, `QCU_BROWSER_EXECUTABLE`, `QCU_THEME_PACKAGE`, `QCU_THEME_BROWSER_OUT`):

  ```sh
  rtk proxy node scripts/build-teacher-theme.mjs .work/theme-viewport/package
  rtk proxy node --test tests/teacher-theme.test.mjs tests/teacher-theme-viewport-browser.test.mjs
  ```

- Handoff: `.work/theme-viewport/RESULT.json` and `package-manifest.json` record source/package hashes and evidence. The generated package contains exactly the existing six files. Import the three reviewed source changes and the new test; the parent owns final application rebuilding and native/teacher acceptance. No app rebuild, Git writes, receipts or expert/market suite runs were performed. An initial filename inventory included the parent directory and returned only this task; no integration source contents or outputs were opened, and all writes/builds/browser checks stayed in this worktree.
