# QCU study coach: private rc.2 pilot

This provider exposes the unchanged canonical `chengyuan-study-coach` instructions
as an in-memory Skill. It gives study steps/checklists and does not write assignments,
read files, execute tools, access the network or launch child processes. It does not
provide school-approved assessment rules. Model responses still require separate
synthetic acceptance; unit tests do not prove learning effectiveness.

The Bundle row is disabled by default. It requires explicit activation and the
normal official management approvals/restart lifecycle. Fixed peers: Cordis 4.0.4,
DSH Skill 0.2.0-rc.2. No dependencies, installation scripts, build approval, version
exemption, permanent Full Access, Creator enablement or DSH source patch.

`skills/chengyuan-study-coach/SKILL.md` is the source of truth. The staging script
checks its reviewed SHA256 and generates a literal `skill-content.js` only in the
TGZ, alongside the identical Markdown. No generated duplicate is kept in Git.
Do not run npm pack directly from this template directory: use
`scripts/stage-study-coach-pilot.py --out NEW_DIRECTORY`. The final archive contains
only the explicit eight-file allowlist and is verified before any installation.

Real installation/activation is not approved by preparation. First use must be in
a separately reviewed independent test profile, after checking for an existing
Skill of the same name, with per-call official approvals and normal restarts.
