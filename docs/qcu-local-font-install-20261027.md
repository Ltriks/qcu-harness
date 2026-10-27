# Local font update installation - 2026-10-27

Installed four reviewed local TGZ updates using the official desktop plugin manager, followed by normal quit/reopen of the existing QCU app rc4.1. Kept the same Home and desktop profile. No uninstall, Home migration, credential read/copy, extra script permission or compatibility exemption. Hub, mini and complete offline suites were not changed.

| Package | Installed version |
|---|---|
| qcu-branding | 0.2.5-font.1 |
| qcu-course-workbench | 0.1.0-pilot.1.3.font.1 |
| qcu-market | 0.1.0-pilot.15.2.font.1 |
| qcu-expert-teams | 0.2.0-pilot.3.font.1 |

Expert pilot.3 business changes from 460bae49d1cf78a68b16525beedd7fa66a5b4d1f are preserved. No Hub administration changes from that commit were included. Compared candidate files with the fixed pilot.3 archive; business files are byte identical, protocol differs only in version, view differs only in existing typography changes.

Native checks: all 55 installed package members match the fixed archives. Home, teaching tools, course, market and expert UI load. Official font 14 -> 16 -> 14 visibly changes home/menu and course typography live. Final size14, appearance remains follow-system, app left open on teaching home. Read-only market refresh verified the signed catalog and showed10 tools. Existing expert team/expert/run counts remain visible. No real model call in this task.

Validation: expert43 source tests and the same43 unpacked tests, theme/DOM21, course/market24 and actual packaged client browser13 all pass. Duplicate source/unpacked execution does not increase distinct coverage. Three unavailable historical archive-only cases remain untested. Native dark/narrow matrix was not repeated; browser tests cover it.

Persistent packages, hashes, member inventories and BEFORE/AFTER receipts: /Users/mcq/Artifacts/qcu-harness/0.1.0-rc.4.1/local-font-install-20261027/ . Keep package paths for local package-manager resolution; never overwrite prior complete release ZIPs. CLI session logs and used personal Homes were excluded.

Build with existing audited SDK; no downloads. Market build.mjs --client-only preserves fixed catalogs/update pins. Theme uses scripts/build-teacher-theme.mjs then scripts/pack-teacher-branding.py. Other products retain their build/pack scripts. Task contract: .ai/tasks/QCU-LOCAL-FONT-INSTALL.md. Full reviewed build evidence is in verification/BUILD-RESULT.json in the artifact directory.
