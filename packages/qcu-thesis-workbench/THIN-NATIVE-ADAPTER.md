# Fixed QCU native adapter, version 1

This successor external bundle owns the official Cordis Host plugin, Client contribution, Python lifecycle, QCU assets, tools, and skills. Its source-private publisher now connects to the companion fixed Electron adapter over the existing desktop-owned Node parent/child IPC channel. The companion adapter is implemented under `upstream/apps/desktop/src/qcu-host-binding.ts` and `qcu-task-panel.ts` in this migration. Installing the external bundle alone cannot install a preload or modify Electron main; the original unpatched desktop remains unavailable and receives no QCU messages.

The native integration has only three responsibilities: expose the fixed five-operation preload API and authenticate its application window/top frame, privately associate the exact live Host owner with that desktop child generation, and own the isolated QCU view and awaited private-session teardown. There is no provider registry, socket, generic task dispatcher, arbitrary command/path/URL API, public Host RPC, or renderer target discovery. Synthetic checks do not certify production Electron behavior, OS isolation, real upload, native dialogs, or a completed macOS acceptance run.

## Required QCU Office launch policy

The matched QCU Office entry installs the fixed launch-owned policy in `upstream/apps/desktop-host/src/qcu-policy.ts` before configuration entries. Its detached Context owns monotonic tool and attachment admission until Host process exit, including after the business plugin or the application root is disposed. Standard official Tools replacement is rebound before dependent plugin execution; unsupported provider identity/scope or binding failure terminates the Host synchronously. This is trusted application policy for the pinned official runtime, not an arbitrary Node-plugin or OS sandbox.

Actual negative/missing-ack Cordis tests preserve the old unprotected result as a control: standalone explicit business unload removes ordinary-tool and HTTP attachment guards. Under protected launch, ordinary tools stay denied and attachment requests remain 403 after the same removal; root closure changes admission to fully unavailable. This resolves that specific unload defect only on the combined supported launch path. Installing the external bundle alone does not install the policy or establish equivalent isolation.

The dedicated entry selects its own app-data/home namespace on every cold start, and does not fall back to ordinary DSH when business configuration is missing. Ordinary updater replacement is disabled; an ordinary mandatory-release policy is rejected. A qualified QCU distribution/update path, native GUI, real storage erasure, and Host-kill Python recovery remain outside the established evidence. No real-profile deployment or stable-r5 replacement is authorized by these development tests.

## Renderer-visible protocol, version 1

`src/native-contract.ts` is React-free and has no Electron, filesystem, child-process, service-target, or Host import. The optional object lives at `window.dshDesktop.qcu` and has exactly:

```ts
{
  protocolVersion: 1,
  available(): Promise<boolean>,
  open(contextId: QcuContextId, bounds: QcuBounds): Promise<void>,
  setBounds(contextId: QcuContextId, bounds: QcuBounds): Promise<void>,
  close(contextId: QcuContextId): Promise<void>,
  back(contextId: QcuContextId): Promise<void>
}
```

The marker, exact methods, and `available() === true` together identify the one fixed isolated-panel capability. There is no capability registry. Missing bridge, missing method, extra bridge member, rejected availability, disabled plugin, unbound/dead service, cleanup failure, or mismatched version must fail closed. A legacy unversioned bridge is not a fallback. Native main must enforce the same supported version through its fixed versioned IPC channels and must not trust renderer self-reporting of availability or version.

Each command has an exact argument count: zero for `available`, two for `open`/`setBounds`, one for `close`/`back`. The parser rejects other operations and extra arguments. The actual preload must expose these fixed methods, never a public generic `invoke(operation, ...args)` method. `parseQcuNativeRequest` is validation support for the five IPC handlers, not a registration mechanism.

An occurrence is a fresh random UUID created for an explicit open click. The wire validator accepts only 1–256 ASCII letters, digits, underscores, or hyphens and brands the value as `QcuContextId`. The identifier is not a session ID, document ID, authorization credential, filename, or payload channel. Main derives the owner from its authenticated IPC event, not from an argument. `QcuBounds` has only finite `x`, `y`, `width`, and `height` numbers, magnitude at most 100,000; dimensions cannot be negative. Bounds are fractional CSS viewport pixels. Native main applies owner zoom, clips to the owner's content area, and rounds inward in DIP; it must not multiply by device-pixel ratio.

Only a boolean capability result, void completion, or a fixed sanitized error may return to the application renderer/mainClient. Never return document body, filename, document/report ID, URL, service origin, bridge token, route, filesystem path, command, or provider ID. No print/download/upload/read-file operation belongs on this bridge. Actual file selection and upload remain inside the isolated QCU document. `back` always means the fixed `/task` document and cannot select another route.

## Private Host-to-Electron binding

`src/host/local-owner.ts` defines an internal capability that is not exported from the package:

```ts
interface QcuPrivateServiceBinding {
  available(): boolean
  acquireNativeTarget(): Promise<{ readonly origin: string }>
  onRevoked(listener: () => void | Promise<void>): () => void
}
```

`QcuDesktopBinding` is created synchronously inside the existing Cordis Host effect. It installs process listeners only when the patched desktop supplies the fixed launch marker `DSH_QCU_PRIVATE_IPC=1` and the process has a connected `process.send` channel. The desktop removes an inherited marker when no QCU adapter exists. The marker advertises support; it is not a password, persistent credential, or authentication claim. The authenticated owner is the exact Node child/connection created by the desktop. A malicious same-privilege process or malicious trusted Node plugin is outside this protection.

After service and packaged-skill readiness, the Host sends a fixed `qcu:hello` containing only version 1 and a random owner UUID. Electron selects that exact child and answers `qcu:bind` with its fresh generation UUID and positive correlation ID. The Host validates that fixed initiation and sends `qcu:ready` with the origin; Electron validates it and replies `qcu:grant`; native availability stays false until the exact Host answers `qcu:granted`. Every message has exact allowed keys. Other operations, expanded payloads, wrong versions, invalid origins, and malformed current-connection data fail closed. Stale owners/generations/children cannot enable the current binding. The handshake has a bounded five-second deadline beginning after the service is ready, not a deadline merely because the bundle is absent.

The Host revokes local admission synchronously before notifying its listeners. Each listener's returned promise becomes part of `QcuLocalOwner.stop()`'s barrier. Service cancellation begins immediately, but successful stop also requires the exact `qcu:revoked` acknowledgment of main-owned native teardown. For Host-initiated revocation, Electron retires admission synchronously, runs and awaits its teardown callback, then returns the matching `qcu:revoked` with a boolean completion result. The parent-initiated `revoke(child)` likewise retires immediately and awaits teardown before sending `qcu:unbind`; the exact owner returns `qcu:unbound`. Concurrent Host revoke and shell unbind join the same cleanup. Native cleanup failures or bounded acknowledgment failures never count as successful stop.

`QcuHostBinding.attach(child)` and `handleMessage(child, message)` are called by the companion `DesktopHostProcess`, ahead of its ordinary Host-event validator. `disconnected(child)` handles child error/disconnect/close, closes admission immediately, and invokes teardown without depending on a cooperative Host message. Replacement selects a new exact child/generation immediately, suppresses obsolete readiness, and holds the new grant behind the preceding cleanup barrier. The same main binding instance survives replacement. Cleanup failure permanently blocks its capability until application restart, including after a new Host/plugin instance. `revoke(oldChild)` cannot close a newer child. No target is parsed from stdout.

Electron accepts only `http://127.0.0.1:<port>` with port 1–65535 and an optional final slash, then canonicalizes to origin and appends `/task` itself. It rejects aliases, IPv6, HTTPS, credentials, extra paths, query, and fragment. This control-channel origin never enters native renderer IPC, Client state, conversation/session data, logs, or tool observations. The unchanged legacy two-tool workflow still deliberately returns its already-defined local workbench/report links; those contain no bridge bearer credential. That legacy workflow is separate from native task transport and its URLs are not a native capability or target-discovery API.

No public `ctx` service, public Client/RPC method, package subpath export, Client boot injection, or persistent service credential is added. `process.send` is the only transport; the bridge credential remains owned by the existing Host/Python lifecycle and never travels in these private messages. A native transport failure closes native access but does not pretend that the ordinary legacy tool service has failed. The existing Host tool guard continues to follow actual service readiness.

## Mandatory native policy to preserve

The adapter must retain the candidate QCU policy, rather than delegating to a generic browser guest with broader permissions:

- One fixed QCU task occurrence per owning window, in a freshly named nonpersistent `qcu-task-<random>` partition with cache disabled and direct proxy routing
- `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, `webSecurity: true`, `webviewTag: false`, `devTools: false`, `spellcheck: false`, `navigateOnDragDrop: false`, and **no preload** in the isolated QCU document
- Exact private origin only, no credentials/query/fragment, no alternate URL spellings, no redirects, no child frames/webviews, no external windows or login challenges, and no external-browser fallback
- GET allowlist: `/task`, `/task-panel.js`, `/task-panel.css`, `/api/rules`, `/reports/<32 lowercase hex>`, and `/reports/<32 lowercase hex>/download`
- POST allowlist: `/api/task/upload` and `/api/task/run`; all other methods/routes are denied, including privileged bridge/health API routes
- Document navigation only to `/task`, the exact report route, or the exact report-download route; Back always loads `/task`; popup requests can only become an allowed same-view task/report navigation without a POST body, and always deny new-window creation
- Permission request, permission check, device permission, and display-media handlers deny access; requests must also belong to the exact live QCU webContents and must not be subframe requests
- Downloads require the exact live, loaded report-download document, MIME `text/html`, an unchanged URL chain, and one native activation within 1,500 ms; a left mouse-up or unmodified Enter/Space key-down arms one activation, while automatic/repeated/script-only triggers do not
- A download uses a native save dialog with default name `qcu-thesis-report.html` and HTML filter; no programmatic save path; consume activation on each attempt, track allowed downloads, cancel them on revocation, and surface only fixed safe errors
- Printing is armed only by non-repeated native Ctrl/Cmd-P on a loaded exact report document with no Shift/Alt modifier, with at most one pending print; invoke `print({silent:false, printBackground:true})`, never silent printing or renderer-requested print RPC

The exact document policy covers permitted QCU task HTTP requests, not arbitrary same-origin network access. Adding a service endpoint does not automatically authorize that route in the native session. The Python application and native filter remain separate checks. This design does not claim that Node plugins or the Python process are an operating-system sandbox, nor does it protect against a malicious same-privilege local process.

## Occurrence lifetime and teardown

Native main must synchronously retire the active occurrence before asynchronous cleanup whenever it is replaced, closed, disabled, unbound, disposed, or its owning window/main-frame/renderer/Host disappears. Cancel associated native downloads, revoke the lease, hide/remove and close the view without waiting for beforeunload, and suppress every late ready/load/proxy/open completion. A closing occurrence cannot act on a newer occurrence. A close arriving before its corresponding open must retire that ID; retired IDs cannot reopen during that owner lifetime. Duplicate open of the current ID joins the same open and can update bounds.

Await view destruction and private-session `closeAllConnections`, `clearStorageData`, `clearCache`, and `clearAuthCache`. Admission after any cleanup failure remains closed until application process restart, including after backend/Host replacement. Do not reset that state with a new plugin instance or swallow cleanup failure and reopen. A new occurrence waits for earlier private cleanup before creating a view. Native owner/Host teardown is authoritative and cannot depend on a cooperative Client unmount handler or renderer-supplied close.

Close means revoke the isolated panel/context and erase its private browser session. It does **not** cancel a server computation already accepted by QCU. On return, the isolated `/task` document restores its own state without submitting another check. The application Client must not obtain that state to implement Back or progress display.

## Tests and their limits

`tests/native-contract.spec.ts` validates the exact v1 renderer capability/operation/argument protocol. `tests/native-adapter.spec.ts` checks the pure test-support dispatcher and remains synthetic policy coverage rather than a shipped Electron entrypoint.

`tests/native-private-binding.spec.ts` exercises the actual private publisher and main binding: inert missing/unpatched IPC, exact field and origin validation, withheld admission before grant acknowledgment, child/owner/generation correlation, synchronous revoke, delayed and failed teardown, cleanup-before-replacement, obsolete traffic, bounded deadlines, concurrent stop, and persistent failure closure. `tests/native-process-ipc.spec.ts` starts real Node children with synthetic service owners and the actual private modules. It verifies actual inherited IPC grant/revoke/unbind messages, that Host stop waits for native acknowledgment, that cleanup rejection is not success, and that unexpected child death revokes main admission. These tests run no model, Electron GUI, real profile, upload, or real Python service.

`tests/host-native-unload.spec.ts` injects negative and missing native acknowledgments into the actual Cordis plugin and confirms that explicit unload removes ordinary-tool and HTTP attachment guards while Python stops. `tests/host-lifecycle.spec.ts` separately checks the official Cordis entry and real packaged Python lifecycle with temporary synthetic homes, including direct owner stop barriers and cleanup failure. Cordis catches effect-disposer errors during unload, so a resolved `fiber.dispose()` alone is not a successful-native-cleanup assertion. The main-process latch remains authoritative. Unloading the bundle also removes its dedicated-profile tools/guards; these tests do not claim that a caught disposer failure keeps an unloaded plugin installed.

Run `npm run test:native`, `npm run typecheck:native`, `npm run test:host`, and `npm run typecheck:host`. These checks do not verify native Electron sender authentication, real session storage deletion, save/print dialogs, operating-system sandboxing, real window geometry, or the end-to-end macOS task. The companion desktop adapter and installed-bundle tests provide their own additional evidence; actual platform acceptance remains separate.
