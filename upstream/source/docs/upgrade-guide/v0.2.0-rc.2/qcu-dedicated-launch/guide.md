---
kind: upgrade-guide
description: "The downstream QCU candidate requires its fixed Office entry, isolated data roots, and launcher-owned restrictions instead of unloadable bundle policy."
---
# QCU requires its dedicated Office entry

English | [中文](guide.zh.md)

## Change

This downstream candidate is based on root version `0.2.0-rc.2`, not an official DeepSeek Harness release. Previously, explicit business-plugin unload removed its tool/attachment restrictions even when native teardown acknowledgment failed; removing bundle configuration also removed its disabled rows.

The fixed `lib/qcu-main.js` entry configures QCU Office's separate `qcu-office` application/profile directories. Successful setup records the Electron App identity in a private process-local WeakSet; shared main reads `isQcuOfficeLaunch(app)`. A bare `--qcu-dedicated` flag has no authority. No persistent mode file is used.

Desktop Host installs process-lifetime policy before entries through trusted `runProfile.prepareRoot`. Separate `launchPatches` retain the original 28 disabled root rows, applied last after mutable profile layers on every composition. Invalid patches or missing targets reject startup/reload; rejected reload preserves the running tree. Ordinary profiles without launcher patches are unchanged; patched ordinary Desktop rejects selected/skipped formal QCU bundles.

An independent Cordis owner retains policy despite business removal or absence. Only two QCU tools are permitted, and model attachment ingress is rejected. Missing tools readiness denies admission; binding failure terminates Host immediately. Root disposal closes admission permanently. QCU disables ordinary Desktop updates and rejects configured ordinary mandatory-release policy.

## Migration

1. Rebuild the separate candidate with [Desktop metadata](../../../../apps/desktop/package.json) selecting `lib/qcu-main.js`. Preserve ordinary DSH and existing profiles. Current acceptance uses synthetic profiles and does not approve real-profile deployment.
2. Update [entry configuration](../../../../apps/desktop/src/qcu-office-entry.ts), [runtime policy](../../../../apps/desktop-host/src/qcu-policy.ts), [the 28 restrictions](../../../../apps/desktop-host/src/qcu-profile-policy.ts), and [profile preparation](../../../../apps/cli/src/profile-boot.ts) together. Replacing only the business bundle is insufficient. Launcher rows require unique literal root IDs, exactly `disabled: true`, no extra fields, and existing targets; do not weaken validation for a changed upstream profile.
3. Expect `qcu-office/electron` for user data, `qcu-office/session-data` for browser sessions, and `qcu-office/home` for `DSH_HOME`. Inherited overrides are replaced. Paths must be real directories; POSIX requires current-user ownership and owner-only permissions. Existing permissions and profiles are not changed/copied; setup failure never falls back to ordinary data. Windows ACL isolation remains unverified.
4. Switch to ordinary DSH only after terminating the whole QCU application and selecting the separate ordinary entry. Business reload, Host restart, profile edits, and native retries cannot change mode. Private `DSH_QCU_DEDICATED=1` carries the child-launch choice; `DSH_QCU_PRIVATE_IPC` does not select policy.
5. Verify tool/attachment denial, retained disabled rows after bundle removal and attempted user overrides, rejected reloads, and business-absent restart. Use [policy tests](../../../../apps/desktop-host/tests/qcu-policy.spec.ts), [standard-Web tests](../../../../apps/cli/tests/profiles/web/tests/qcu-persistent-restrictions.expected.e2e.ts), and entry/lifecycle checks. Source edits alone are not evidence.
6. Pure official CLI bundle execution does not install this policy. Arbitrary trusted Node code is not sandboxed; abrupt Host termination can orphan Python. Mac GUI acceptance, signing, automatic migration/update compatibility, and production approval remain unestablished.
