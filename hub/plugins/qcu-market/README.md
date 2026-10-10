# QCU market — 0.1.0-pilot.4.1

One fixed independent coach package, downloaded on demand from the trusted LAN Hub. **Installation needs no model, API Key, session, message or agent tool.** This is local candidate source, not a deployed market.

## User flow

1. Check the current profile or prepare the fixed package. The QCU Host downloads only the compiled release, verifies exact size/SHA256 and returns a five-minute receipt. The coach TGZ is not embedded in the market package. Availability is established by the current download and integrity check; offline/404 remains an error.
2. The official public `pluginManager.inspect` checks the absolute TGZ spec. Its tarball inspection checks the form, not the manifest; QCU relies on the reviewed immutable archive hash for the displayed name/version/license and the official installer for bundle/runtime compatibility checks.
3. A dedicated review section displays package, version, source, hash, size and privileges/network/profile-write risks. Only **Confirm install (keep disabled)** calls the official public `installBundle`, with `enabled:false` and a fresh request ID. Verification and inspection run again before that call; expiry, source/hash/registry/profile changes invalidate confirmation. Declining does not install. No scripts, compatibility exemptions or permissions are silently authorized.
4. Cancellation uses official `cancelInstall`; only confirmed cancellation is called cancelled. An early not-running reply waits for the official acceptance event before retrying cancellation once. Too-late, lost replies and unknown outcomes remain visible, block repeated installation and support `waitForInstall` reconciliation. No automatic install retries.
5. Installation success is checked against the exact installed version and disabled bundle. Bundle enablement and exact component enablement require separate review and confirmation. Restart is an instruction to the user, never an automatic operation.
6. Active component state is explicitly **not** proof of skill discovery in a chat. A copyable synthetic learning example has real copy failure/manual fallback. Sending it is outside installation and uses the user's normal model configuration.

## Ownership and permissions

The Host service uses public Typert registration and strict descriptors for only `prepare(UUID)`, `verify(UUID)` and `cancel(UUID)`. No URL, path, installation or general management argument exists. It has no manager, skills, sandboxPolicy, commands, tools, agents or session dependency. The Client mounts these descriptors with the public `$mount` API and calls the existing official management namespace only from the corresponding explicit user action. No private controller or UI package runtime import is used; React is the sole Client runtime import.

The Host reads/writes only its fixed package cache `~/.cache/qcu-market` in this implementation (creating `~/.cache` if absent), with owned-directory checks, no-follow read, exact hash/size, 0400 immutable link, temp cleanup, 30-second download limit and maximum 1 MiB. Receipts are in memory, at most 16, and expire after five minutes. It contacts only `http://192.168.1.68:8080/plugins/<pinned-file>` on preparation; redirects and encoded responses are refused. HTTP does not provide confidentiality; the compiled digest authenticates these reviewed bytes.

Client profile-status reads call public `listBundles`; `listPlugins` is only read when the exact installed bundle is enabled. These APIs return profile-wide metadata, filtered locally. No skill body or conversation is read. On load, only the existing Host transport is used to mount the namespace and subscribe to installation progress; no inventory read or Hub download occurs automatically.

**These are code restrictions, not an OS sandbox.** Installed Host code runs in process with the application's user privileges. Confirmed official installation can update the profile manifest/lockfile, dependency files, pnpm cache and logs, and contact configured registries/mirrors for dependency resolution. Changes affect all sessions of that profile. Existing profile-wide build permissions remain official installer policy; QCU adds no permissions. A non-running result, failed installation or cancelled operation is not promised to remove all downloaded files.

## Tests and deployment

See `docs/qcu-market-direct-install.md`. The official Client/Gateway/registry path is tested through an in-memory carrier; installation and activation calls in tests use fakes. No live App, profile, package manager, Mini or Hub is modified. `pilot.3.1` was a conversation bridge and remains an immutable historical artifact; pilot.4 replaces that route, not those bytes.


## pilot.4.1 dependency repair

Immutable pilot.4 remains unchanged. Its live Client failed because package loading prerequisites were mistaken for Cordis service injections. The persistent shell declares `slots` and `layout`; a `remote` owner mounts QCU descriptors, and its consumer declares `remote.pluginManager` and `remote.qcuMarket`. An independent `pluginNavigation` consumer owns the details callback. Missing services keep a visible unavailable shell, and withdrawal disposes the flow and subscriptions before the owned namespace. No wildcard, new management method, Host service, peer, endpoint, origin or filesystem capability is added.

The regression starts the actual source and packaged Client inside real official Cordis fibers with official ClientRemote and generated manager codecs. It reproduces the pilot.4 error, then exercises scoped startup, every used manager call, preparation/decline, missing services, late arrival, withdrawal/remount, transport reset/disposal and Host failure. The Host Gateway unload test aborts an in-flight synthetic preparation. Host answers and installation remain simulated; this patch has not been installed on the Mini.
