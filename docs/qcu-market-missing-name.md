# QCU market missing-name fix — unpublished pilot.17.2

Implemented only `QCU-MARKET-MISSING-NAME`. Update rows, official-page actions,
selected targets and review headings/buttons now use the same display lookup:
the existing catalog title, otherwise the product ID. Existing named labels and
click target IDs retain their wording and identity. No catalog entry or title
was invented for reading. Source verification, policy, signatures, origins,
archive limits, consent, RPC protocol 6 and runtime `0.2.0-rc.2` are unchanged.

The six modified existing files are market `src/update-view.mjs`,
`src/remote-contract.mjs`, `package.json`, `pack-pilot.py`, generated `client.js`,
and the two necessary version assertions in `tests/qcu-market-teacher.test.mjs`.
The only new tracked files are the rendered regression
`tests/qcu-market-missing-name.test.mjs` and this document. Reading source,
package version and artifacts remain frozen. Root README, reading roadmap,
native evidence and previous reports were not edited.

All new persistent build/test output is under
`.work/qcu-market-missing-name/` (called **stage** below). Disposable profiles and
browser data used owned `/private/tmp` directories. No dependency installation
or download was needed.

| Artifact | Exact output |
| --- | --- |
| Candidate | `stage/candidate/qcu-market-0.1.0-pilot.17.2-272ee85c4314fbe907a83843322e62dcb6b71ba23c304dad68787e7125444440.tgz` |
| SHA256 | `272ee85c4314fbe907a83843322e62dcb6b71ba23c304dad68787e7125444440` |
| Size / members | **88,000 bytes / 24 members** |
| Independent rebuild | `stage/rebuilt/`, byte-identical candidate and manifest |
| Bounded exact unpack | `stage/exact/package/`, all 24 members equal source |
| Package proof | `stage/exact-package-proof.json`; default disabled, unchanged peers, no scripts |
| Member delta from fixed 17.1 | Only `client.js`, `package.json`, `src/remote-contract.mjs`; other **21 members identical** |

The prior market17.1 archive remains
`4d2520413d3f7c405a63852d8d94a41bd3628e06c589475e651f05f6b688af1b`
(87,996 bytes). Reading remains immutable pilot.4 SHA256
`d50d449b06e7840ef30442a13c3bc2b1b1bc7d3e61bdc47c23a807d743d15f50`
(628,171 bytes, 29 members). No 17.1 or earlier intermediate artifact was
overwritten. `stage/preservation-proof.json` checks the initial source inventory,
all 348 prior admission-stage files, and all 67 frozen reading artifact/handoff
files. It also records exact changed/new source paths. During the final audit,
the concurrent parent changed root `README.md`,
`docs/qcu-reading-native-acceptance.md` and
`docs/qcu-standalone-learning-plan.md`; their observed hashes are recorded as
unowned status changes. Parent also added
`docs/qcu-reading-pilot4-native-acceptance.md`. This implementation did not edit
or revert any of these paths.

The new rendered test mounts the actual hook-using update view with React DOM
in isolated Chromium. The reading case materializes immutable pilot.4 bytes
without executing them, uses the exact admitted production product map with an
ephemeral test key, and verifies genuine v3/v2 404 fallback to a signed legacy
feed without reading. The resulting real Host check reports installed reading
as `source-unknown`, `sourceVerified:false`. With reading absent from both
catalogs, the rendered heading/button show `qcu-reading`; clicking routes that
exact ID and preparation refuses before download/install.

A separately isolated synthetic `qcu-nameless-probe` fixture exercises an
available target absent from both catalogs: row, target, review heading and
confirmation button all retain its ID. It checks an existing title's exact
wording, an independent missing-title official-page route, cancellation with
zero installs, and one synthetic update only after explicit confirmation.
No enable operation occurs. This test-only synthetic policy does not modify
production admission. The compiled regression instruments only the factory
return to expose existing view/flow closures; the separate full browser test
loads **unmodified exact-package Client bytes** and the matching packaged Host
through the official rc2 Gateway.

| Validation | Exact result | Stage evidence |
| --- | --- | --- |
| Pre-fix17.1 rendered reproduction | **2 expected failures**, source and compiled; actual body contains `在官方页面处理undefined` | `baseline-regression-loopback.log`, `baseline-rendered-loopback/{source,compiled}/results.json` |
| Fixed source + generated Client rendered regression | **2 passed** | `source-regression.log`, `source-rendered/` |
| Exact-package compiled rendered regression | **1 passed** | `exact-regression.log`, `exact-rendered/compiled/` |
| Existing source admission | **21 passed** | `source-admission.log`, `source-admission/` |
| Existing exact-package admission | **21 passed** | `exact-admission.log`, `exact-admission/` |
| Official Cordis/SlotRegistry/LayoutController and manager read-only inventory | **2 passed** | `official.log`; uses exact candidate Client |
| Existing affected flow/view/teacher regressions | **172 passed, 2 pre-existing Guide failures** (174 tests) | `affected-regressions.log` |
| Unmodified exact Client / packaged Host / official Gateway / Chromium | **1 passed**, 15 screenshots, no overflow/errors/external requests | `exact-browser.log`, `browser/results.json` |
| Local signed publication and manifest-pinned Hub routes | **2 passed** | `publication.log`, `publication-check/` |
| Build, independent rebuild, pack and all-member parity | **Passed** | `build.log`, `rebuild.log`, `pack.log`, `repack.log`, `package-check.log`, `exact-package-proof.json` |

There are **222 passing checks** in the completed test runs, plus the two known
Guide failures. Those unchanged tests call hook-using `Guide` directly outside
React rendering and fail with `Cannot read properties of null (reading
'useState')`. The parent's independent clean-source2a proof is copied to
`stage/parent-BASELINE-GUIDE.json`; the Guide test/view/helper bytes remain
unchanged. This task does not fix them.

The initial `baseline-regression.log` is a failed harness attempt: the first
source snapshot lacked a transitive import and sandboxed loopback listen was
denied (`EPERM`). Its outputs are retained and are not passing or bug
reproduction evidence. The subsequent complete pre-fix snapshot and owned
loopback run reproduced the real undefined labels in both boundaries. The new
`stage/baseline/` holds only pre-fix17.1 inputs; the original admission baselines
at `.work/qcu-reading-market-admission/baseline/` were reused unchanged by all
21-test runs, never recaptured from modified source.

The initial `preservation.log` correctly flags concurrent parent status edits
against the initial inventory; `preservation-final.log` then flags the newly
added parent native report. `preservation-complete.log` records the completed
audit separating those unowned paths from the six scoped implementation changes
and two new files. All prior artifacts and frozen inputs still match their
original hashes.

Every command, exact argument list, audited dependency environment, exit code
and raw combined output is retained as `stage/<label>.command.json` and
`stage/<label>.log`. Reproduction uses:

```text
auditNode24 = /Users/mcq/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
QCU_OFFICIAL_DEPENDENCIES = /Users/mcq/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source
QCU_BROWSER_DEPENDENCIES = /Users/mcq/.cache/codex-runtimes/codex-primary-runtime/dependencies/node

rtk proxy auditNode24 hub/plugins/qcu-market/build.mjs --client-only
rtk proxy python3 hub/plugins/qcu-market/pack-pilot.py <fresh-output-directory>
rtk proxy auditNode24 --test tests/qcu-market-missing-name.test.mjs
rtk proxy auditNode24 --test tests/qcu-reading-market-admission.test.mjs
rtk proxy auditNode24 --experimental-transform-types --expose-internals --test tests/qcu-reading-market-browser.test.mjs
```

Expand `auditNode24` to the above absolute executable. Set `QCU_MISSING_OUT` to a
fresh stage directory for rendered runs. For the exact compiled-only regression,
set `QCU_MISSING_MARKET_ROOT=stage/exact/package` and add
`--test-name-pattern=^compiled`. For admission use a fresh `QCU_ADMISSION_OUT`,
plus `QCU_ADMISSION_MARKET_ROOT=stage/exact/package` for the exact run. The full
browser requires `QCU_ADMISSION_OUT=stage` and a fresh
`QCU_ADMISSION_BROWSER_OUT`; it deliberately refuses reused signed-feed paths.
Preserve existing candidate/evidence directories on every rerun.

The new source-unknown/review screenshots and representative full-browser
desktop/light and narrow/dark screenshots were visually inspected. New rendered
fixtures are intentionally unstyled; the full Client harness retains the real
styles. Browser results record closed browser contexts, stopped owned servers,
and connection refusal after closure. Only the test's own servers/processes
were closed. Installation effects in both browser harnesses are synthetic;
the full scenario records two explicit synthetic installs and zero automatic
installs, model calls, real credential accesses or external browser requests.

No Git, receipt helper, nested executor/agent, native app, real DSH Home,
credentials, production key, model, live Hub, mini, permissions change or
deployment/install was performed. Parent's concurrent native DSH was not
inspected or controlled. Native acceptance of17.2, review/freeze/commit/push,
production publication/deployment and any independent fixed-package
confirmation remain **unperformed and parent-owned**.

## Parent independent review

Parent independently reran the exact compiled React regression (1 passed),
checked30 parser/signature/Host/fallback points against exact17.2 (all passed),
verified all24 members against final source and repeatable packaging, and
confirmed only the three declared member changes from immutable17.1. The
rendered source-unknown button correctly showsqcu-reading and keeps verification
uncertainty. Parent native work in parallel completedreading4 parsing and
old-record preservation; this is documented separately and is not17.2 native
acceptance. Safe output is frozen under
`$HOME/Artifacts/qcu-harness/0.1.0-pilot.17.2/`; actual commit identity is bound
there after the scoped commit.
