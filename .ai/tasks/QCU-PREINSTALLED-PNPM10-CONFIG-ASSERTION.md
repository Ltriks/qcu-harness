# QCU-PREINSTALLED-PNPM10-CONFIG-ASSERTION
Parent verification found one fixture expectation mismatch, not product failure. Scope ONLY tests/qcu-preinstalled-official.test.mjs. No other files, commands, tests, snapshots, receipts or Git. Minimal patch:
- fixture creates configDir/config.yaml and auth.ini for v11. Also create an empty configDir/rc for default pnpm10.
- existing expected globalconfig chooses globalYaml for >=11 else globalConfig. Actual pnpm10.32.1 reports join(configDir,'rc') (isolated XDG). Change only the <11 expected path to that actual isolated rc. Include rc in requested emptyConfigFiles.
- Do NOT relax equality or other config/installation assertions. No business/package/build changes. Parent independently runs relevant pnpm10 scenario afterwards; verified v11 expectation remains untouched.
Evidence .work/preinstalled-parent-pnpm10/official.log. Node24/pnpm11 full actual install, upgrade, preservation, cold loading already passed at .work/preinstalled-parent-final. Don't rerun.
Print short summary and finish.
