# Reading market admission — local pilot.17.1

Implemented `QCU-READING-MARKET-ADMISSION` in the assigned worktree. This is a
local candidate, not an installation or deployment. Parent owns Git, receipts,
production preparation and native/business acceptance.

The corrected **review-final** candidate supersedes the initial unpublished
17.1 intermediate archive (SHA256
`0768d577a706c64490e16e2539f3620ad9525e787adea96887b6c8391e788620`).
The initial artifact/evidence stage remains byte-identical and is historical.
The parent review reproduced a client/parser contract gap: a malformed expanded
or reading-only policy could admit a validly signed reading entry via `pilot`
even though it could not select v3. This was not a production incident or a
credential-exposure claim. A reading-specific entry guard now requires both
`pilot-reading` and the exact reviewed expanded policy, regardless of the
custom legacy policy supplied to the parser. Other legacy fixture contracts
remain unchanged.

`initial-boundary-probe.json` retains acceptance by the initial
actual parser, ephemeral signed-envelope verifier and Host. The corrected
source and exact-package boundary proofs reject 30 validly signed combinations
(ten malformed/reduced policies × three channels) in the actual parser,
compiled Client parser, signed verifier and Host before pin/download. Exact
full-policy v3 and custom non-reading legacy controls still pass.

## Implementation

- Market version is `0.1.0-pilot.17.1`. Official runtime remains `0.2.0-rc.2`,
  Host/Client RPC protocol 6 and catalog schema/protocol 4. New installation is
  still disabled. No theme, layout, official source or migration change.
- `expertUpdatePolicy` freezes the old eleven-product map;
  `legacyUpdatePolicy` freezes the old ten-product map. Both match the captured
  baseline exactly. The production publisher public key is byte-identical.
- The new default policy adds only `qcu-reading`, capability `tools`, with the
  exact ten peers from immutable reading pilot.4. Missing, extra and changed
  peers refuse. Generic `tools` is the existing bundle wire category: reading
  registers no DSH tool or Skill and has no provider.
- Explicit producer projections are `legacy` (`updates.json`, `pilot`), `v2`
  (`updates-v2.json`, `pilot-experts`) and `v3` (`updates-v3.json`,
  `pilot-reading`). V1/v2 retain their frozen product sets. Synthetic and
  excluded products appear in omission reviews. Unknown real products refuse.
  All real entries, including omitted entries, and every requested projection
  are validated before output creation. Production CLI trust stays pinned;
  ephemeral public-key injection uses the existing test function interface.
- Only the exact expanded policy chooses v3. The exact old expert policy still
  chooses v2; legacy and limited synthetic policies choose v1. Exact policy
  matching no longer compares an older policy to a mutable expanded default.
- Only genuine 404 permits v3 → v2 → v1 fallback. Signature, tamper, channel,
  origin, redirect, timeout, expiry, oversize, cancellation and replay failures
  stop. Signed channel and requested URL must agree. New policy fallback reads
  the frozen old product sets, never reading through an old channel.
- Each projection retains its own byte pin in `state-v3.json`, `state-v2.json`
  or `state.json`, with the existing shared publisher revision floor. Prepare,
  cancel, stale consent, journal, fresh-process and configuration/enabled-state
  checks retain the existing flow. Archive/member/file/path/payload limits,
  scripts/dependency/native checks and production origins were not relaxed.
- Static Hub routing/manifest validation adds only the explicit v3 filename.
  Admin authentication, roles, trust roots and publication implementation are
  unchanged.

## Exact artifacts

Corrected final evidence is under
`.work/qcu-reading-market-admission/review-final/`; paths below are relative to
that stage unless prefixed `../`. Initial artifacts and evidence remain in the
parent directory unchanged. `prior-stage-inventory.json` and
`preservation-proof.json` bind preservation of all 225 prior files.

| Artifact | SHA256 | Bytes / members |
| --- | --- | --- |
| Market `qcu-market-0.1.0-pilot.17.1-4d2520413d3f7c405a63852d8d94a41bd3628e06c589475e651f05f6b688af1b.tgz` | `4d2520413d3f7c405a63852d8d94a41bd3628e06c589475e651f05f6b688af1b` | 87996 / 24 |
| Frozen reading `qcu-reading-0.1.0-pilot.4-d50d449b06e7840ef30442a13c3bc2b1b1bc7d3e61bdc47c23a807d743d15f50.tgz` | `d50d449b06e7840ef30442a13c3bc2b1b1bc7d3e61bdc47c23a807d743d15f50` | 628171 / 29 |

`candidate/` and the fresh Node24 `rebuilt/` contain identical market bytes. `exact/package/` matches every source member. Full member hashes,
default-disabled patch and dependency closure are in `exact-package-proof.json`
and `candidate/MANIFEST.json`. The runtime handshake pins the expanded policy
source hash without changing RPC semantics.

Reading source/provenance is pinned to
`2a157b356f6af7a9c8d467ddf7c55701fbc33bff`. No reading code or incoming archive
code was executed by the admission/publication/browser fixtures. The original
reading archive and all 67 inventoried package/handoff files remain unchanged.
The old market15.1 archive also matches its immutable filename SHA256.
`preservation-proof.json` checks reading source, public trust and scoped source
inventory. Concurrent changes to the root README and standalone learning plan
are recorded separately and were not edited by this implementation. Other
worktrees were untouched.

## Validation

| Layer | Final result | Evidence |
| --- | --- | --- |
| Baseline negative | Exact reading archive inspection passed; old product policy refused | `../baseline/negative-proof.json`, frozen policy/source snapshots |
| Admission source | 21 passed | `source-final.log`, `source-projection-proof.json` |
| Exact unpacked candidate | 21 passed | `exact-final.log`, `exact-projection-proof.json` |
| Actual local publication and Hub routes | 2 passed | `publication-final.log`, `publication/`, `routing-proof.json` |
| Exact compiled Client / packaged Host / Chromium | 1 complete scenario passed | `browser-final.log`, `browser/results.json`, 15 screenshots |
| Affected existing market regressions | 190 passed, 2 preexisting guide-test failures | `affected-regressions.log` |
| Prior-stage unchanged Python Hub/admin/publication/distribution regressions | 62 passed | `../hub-regressions.log` |
| Deterministic package and frozen-input preservation | Passed | `exact-package-proof.json`, `preservation-proof.json` |

The two guide tests call a hook-using `Guide` directly outside React rendering
(`Cannot read properties of null (reading 'useState')`). Their test/view/helper
bytes match the initial inventory. The same two failures were reproduced with
the baseline policy/client snapshot and unchanged guide inputs:
`../guide-baseline-source-equality.json`, `../guide-baseline-reproduction.log`.
Parent independently confirmed the same two failures at clean source2a; copied
proof is `parent-BASELINE-GUIDE.json` and `.log`.
They were left outside this task. The existing teacher feedback version checks
were advanced from 16.1 to 17.1 for the intentional candidate version change.

Initial failures remain recorded: sandbox loopback denial, test fixture preview
field mismatch, attachment-policy rejection of extra handoff files, initial
new-test assumptions, and a rerun correctly refusing to overwrite old signed
feeds. The corrected final browser uses a new review-final directory. None are counted
as passing evidence. See `REPORT.md`; initial logs/report remain
in the parent evidence directory as historical artifacts.

## Concrete local path

The real admin API uploaded the actual archive plus a byte-preserving handoff
projection: 25 retained files; 38 optional PNG/log/SHA256SUMS extras omitted under
existing attachment rules. Every retained/omitted hash is inventoried in
`publication/handoff-projection.json`. No upload or checker rule was relaxed.

Using only the existing synthetic account and ephemeral key in disposable
private stores, the test attached honest market metadata, reviewed, prepared,
independently previewed and published. It checked `materialsDigest`,
`marketEntryDigest`, approval entry digest, proposal and publish-preview
bindings, and refused incorrect/stale values. Actual signed catalog and archive
HTTP bytes passed `CatalogAuthority` and the market parser. The entry is a
single-component bundle, `['tools']`, with null Skill/hash/provider. Its
native/teacher statuses stay **untested**.

A preexisting synthetic teacher product stayed byte-identical through reading
publish (revision2), withdrawal (3), and higher-revision restore (4). Stale
publish confirmation refused; the exact reading archive stayed downloadable
and unchanged during withdrawal. This proves preservation, not teacher or
native acceptance.

`offline/` contains actual reading and actual market candidate bytes,
previously supported synthetic coach/expert packages, three producer feeds,
omission reviews, job input and an ephemeral public key. `verification.json`
records real Ed25519 verification and every member fingerprint: v1 has 2
entries, v2 has 3, v3 has 4. Reading exists only in v3. The actual released15.1
compiled parser accepts v1, and the captured pre-change16.1 compiled parser
accepts its v1/v2 projections; both refuse v3. No private test key is saved.

Chromium loads the unmodified candidate `client.js`, paired with its exact
packaged Host through the official rc2 Gateway. Signed catalogs/updates and
downloads are actual loopback HTTP. Only installation effects, the predecessor
reading profile and model/credential adapters are synthetic. Screenshots cover
1120/390px light/dark card/details plus review, disabled installation,
available/review/cancel/stale/pending/restart/complete update behavior. Browsing
and check cause zero installs; explicit confirmation causes one disabled
initial install and one mock update. Configuration and original enabled state
survive fresh mock Host verification. There are zero browser external requests,
runtime errors, model calls or real credential accesses; no horizontal overflow.

Final screenshots were visually inspected in all four theme/width combinations.
`browser/results.json`, publication `server-closed.json` files and
`routing-proof.json` record browser closure, owned server termination and
post-close connection refusal. No parent process was stopped.

## Reproduction and parent steps

Use the task's audited Node24, official dependency and browser dependency roots;
no install/download is required. Commands must be prefixed with `rtk`. Preserve
the original `../baseline/` captures; never recapture them from modified source.

1. Build `hub/plugins/qcu-market/build.mjs --client-only`, pack into a **new**
   directory with `pack-pilot.py`, compare with the candidate and unpack via the
   bounded reader. Current review-final exact unpack is already available.
2. Run `node --test tests/qcu-reading-market-admission.test.mjs`, then repeat
   with
   `QCU_ADMISSION_MARKET_ROOT=.work/qcu-reading-market-admission/review-final/exact/package`.
   Set `QCU_ADMISSION_OUT` to a fresh output directory under this task root for
   every rerun; this preserves the initial and review-final evidence.
3. Run `node --test tests/qcu-reading-market-publication.test.mjs` with local
   loopback permission. It creates and closes only disposable fixture servers.
4. Run `node --experimental-transform-types --expose-internals --test
   tests/qcu-reading-market-browser.test.mjs` with the audited dependency vars
   and `QCU_ADMISSION_BROWSER_OUT` pointing to a **new** directory under this
   task's `.work` root. The producer deliberately refuses existing feed files.
5. Parent reviews source, exact candidate, omission review and screenshots.
   Separately authorize reading pilot.4 native acceptance; review/prepare the
   actual Hub entry with these honest boundaries; produce all explicitly
   required projections using the production signing process; manifest-pin
   them and retain old feeds/archives. Deploy/install only after that approval.
   Normal DSH restart and source/config/enabled-state checks must precede any
   actual teacher/model/business acceptance claim.

No Git command, receipt helper, subagent, nested Codex executor, real Home,
model, mini, remote Hub, production signing key, native GUI or deployment was
used. Production signing, installation and native/business acceptance remain
parent-owned and unperformed here.

## Parent review and teacher delivery

Parent independently checked the corrected source and exact unpack with a separate
30-check parser/signature/Host/fallback script; both pass. The earlier probe
retains nine unexpected accepts before the reading guard. Parent also reran the
actual local publication/routing suite (2/2), checked all24 exact package members
and byte-identical rebuilding, and inspected desktop/narrow screenshots. The two
Guide failures independently reproduce at clean2a. These are local technical
checks, not native installation or teacher approval.

Reviewed delivery: `$HOME/Artifacts/qcu-harness/0.1.0-pilot.17.1/`; source commit
identity and the explicit safe-artifact index are recorded there after freezing.
[Teacher guide](qcu-reading-teacher-guide.md) includes short verification steps.
The parent updated root README and the learning plan intentionally; the initial
CLI's unchanged-source claims describe its own scope. Native reading.4 / market17.1
installation and actual Hub production publication remain pending. R2 is not started.
