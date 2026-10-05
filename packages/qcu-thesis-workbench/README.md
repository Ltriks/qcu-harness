# QCU external bundle with fixed native handoff

This private development package uses the official Cordis Host plugin, `dsh.bundle.patch`, Client discovery, conversation header slot, and filesystem skill provider. The companion fixed native adapter targets official baseline commit `639ed015397290b3745d163aafe02ffee4aa3f84` (`0.2.0-rc.2`). This successor bundle and the companion desktop source changes are separate from the immutable earlier external-only package. The package remains usable without the adapter, with native availability closed.

## Supported protection path

The companion QCU Office entry installs a fixed, launch-owned policy before any profile entry. That policy lives until Host process exit, independently of this business plugin, and the launcher retains the original 28 disabled rows through profile reconciliation. Under that combined, pinned path, real Cordis tests show ordinary tools and attachment routes remain denied after business removal, including failed or missing native teardown acknowledgment. The native-view latch and the model/profile policy remain separate controls.

Installing this bundle alone in ordinary DSH or CLI does not create that lifetime policy. Its own guards still disappear on explicit unload; the unprotected negative-control tests continue to demonstrate this. Use the independent QCU Office entry and matched shell/Host changes; do not describe standalone bundle installation as equivalent protection. No real user profile, Mac GUI, signed installer, or qualified QCU update channel has been validated here. The candidate cannot replace stable r5.

## Dedicated profile requirement

The bundle patch preserves all 28 original disabled-plugin policy rows, native tool presentation, the QCU preset, and the original r5 persona. This includes local file-reference resolution, attachment/reference UI, workspace files, terminals, plugin-manager surfaces, dynamic Cordis runners, telemetry, and default presets. This bundle retains the original global restriction to `qcu_thesis_open` and `qcu_thesis_check`. Install it only in a dedicated QCU profile. It deliberately blocks unrelated tools and DSH attachment admission; it is not an unrestricted office-profile add-on. Removing or unloading the bundle removes its own guards. The supported QCU Office launcher independently retains its exact two-name tool restriction, attachment denial, and fixed disabled rows; ordinary standalone DSH lacks that protection.

The original `plugin/index.js` is copied byte-for-byte. Its two tool definitions, attachment checks, execution guard, and bounded model-visible results are unchanged. A Host admission guard also denies every tool while the local service is starting, stopped, or failed. Missing and invalid configuration, missing Python, startup failure, and later service failure leave both guards installed and produce only a fixed unavailable diagnostic.

## Explicit local runtime configuration

The official bundle patch creates the `qcu-thesis-workbench` Host entry and the restricted `preset-qcu-thesis` entry. Set `workspace-controller.documentsDirectory` separately to an isolated deployment-owned workspace path; the bundle contains no machine-specific path. Configure that entry with `localPython.python` (absolute path to an already installed Python 3 executable) and `localPython.home` (absolute path to an owner-only data directory). The patch's empty values intentionally remain unavailable until configured. Optional positive-integer millisecond deadlines are `startupTimeoutMs`, `shutdownTimeoutMs`, `terminateTimeoutMs`, and `killTimeoutMs`.

The server path is always this package's `runtime/server.py`. Private bridge and ownership records are `home/bridge.json` and `home/server.lock`. Plugin activation installs policy synchronously; fiber readiness does not claim that Python is ready. Admission stays closed until ownership and authenticated HTTP readiness checks pass. The Host owns exactly one child through a Cordis effect; unload first revokes admission and then waits for child/process-pipe closure. Repeated activation, interrupted startup, runtime failure, graceful shutdown, and forced termination have synthetic regression tests. The package never downloads Python, starts a model, or modifies a user's profile outside official bundle installation.

A resolved Cordis `fiber.dispose()` alone does not prove that native cleanup succeeded: Cordis catches effect-disposer errors. Tests inject both negative and missing native acknowledgments through the actual plugin, confirm Python stops, and confirm the explicit unload removes the plugin's tools and ordinary-tool/attachment guards. The main-process cleanup-failure latch remains authoritative for native admission; the unloaded plugin itself does not retain global guards. A matched QCU Office launch adds the independent process-lifetime guard, whose real negative/missing-ack comparison remains denied after the same unload.

## Local document privacy

`runtime`, `rules`, the legacy tool plugin, packaged skill and native task-panel resources retain candidate bytes; the three legacy web files incorporate the reviewed Mac completion-feedback fix; `RESOURCE-SHA256.json` records their bytes. The local task panel keeps DOCX input, filenames, consent, detailed results, and reports inside the private local service. Its `local_task` grant is rejected by `/bridge/run` even if a caller knows the document ID. The Host never registers a publicClient/RPC endpoint for the native task surface and never serializes a service URL, bridge token, or document bytes to that surface.

The packaged `qcu-thesis-format-check` skill describes the separate, legacy two-tool workflow. It requires the user to authorize a document for the conversation and supply its identifiers. This is not the new local task-panel workflow, and local task selection never supplies those identifiers to a model. Skill discovery uses the official `skill-filesystem` provider with a package-specific provider name, `includeDefaultRoots: false`, the package's bundled root, and filesystem watching disabled. Unload removes the provider.

## Client and fixed native integration

The Client bundle is discovered by official Client metadata and mounts a narrow entry in the existing conversation header actions slot. It has no general task registry. The exact native interface and its tests are documented in `THIN-NATIVE-ADAPTER.md`.

The original unpatched desktop does not provide this native bridge. Without the companion adapter, the entry reports unavailable and does not fall back to public RPC, arbitrary navigation, or file transfer. A private effect-owned publisher is enabled only by the companion desktop’s fixed `DSH_QCU_PRIVATE_IPC=1` launch marker and connected parent/child IPC. After service readiness, the exact Host owner and desktop generation complete a versioned bind/ready/grant/acknowledgment handshake. Only Electron main receives the native target. Native revoke/unbind waits for bounded teardown acknowledgment, and cleanup failure permanently blocks main-side admission across Host replacement. The marker is a support advertisement, not a credential. Its private Host binding remains source-internal with no package subpath export.

## Build and validation

Development uses the already available baseline toolchain. `npm run build:host` emits `lib/index.js`; `npm run build:client` emits the official Client factory at `lib/client.js`. Host dependencies are official peer packages and are resolved through the installed official runtime. Development symlinks, source, tests, and build tooling are excluded from the packed files.

Run `npm run typecheck:host` and `npm run test:host` for the Host and process-owner checks. Setting `QCU_SERVICE_PYTHON` and `QCU_SERVICE_REAL_SERVER` enables the real Python regression case in addition to the process-protocol fixtures; the Host tests themselves use the packaged Python server and synthetic temporary homes. Native tests run through `npm run test:native` and `npm run typecheck:native`. These synthetic tests do not certify a real macOS build, signing, notarization, a real user profile, or model behavior.

## Model experience

The two tool names and input schemas are retained. Their outputs now contain only readiness/counts and fixed native-panel guidance: local workbench/report URLs are no longer model-facing results. The native control-channel target is never added to those outputs; No download URL is supplied to chat. No new model calls, prompt transcript fields, document excerpts, or token/KV-cache behavior are introduced. Skill loading follows the official mechanism.

## Known limitations and deferred work

The fixed companion Electron adapter and private IPC are implemented in the migration source; native GUI and real desktop/macOS acceptance remain separate. Availability stays false without that exact active binding. This is a private development package, not a published package or a claim of compatibility beyond the pinned official baseline. The original local runtime's report engine and privacy policy remain its own responsibility and are preserved unchanged here.

## Trust and audit boundary

Official Host plugins are trusted Node code, not an operating-system sandbox for untrusted extensions. This bundle limits its own data flow and retains dedicated-profile restrictions; it does not prevent another malicious Host plugin running under the same OS account from reading files. New plugins and new permissions still require separate review. Resource hashes are reproducibility evidence, not signed or tamper-proof runtime audit logs.
