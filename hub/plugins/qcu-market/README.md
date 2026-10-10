# QCU market — pilot.3.1 local candidate

**Temporary conversation bridge, not direct click-to-install.** Sending the installation draft requires a configured model (and whatever credentials that provider requires) and can consume model quota. Approval is by the local user, never a remote DeepSeek reviewer. Public rc.2 APIs lack a prefilled install-dialog contract; this is a documented product gap.

One installable entry: `qcu-study-coach@0.1.0-pilot.2`, skill `qcu-study-coach`.
Official Office capabilities are help only. Historical draft catalogs remain source material and are not offered as installable packages in this UI.

The Client adds the official `sidebar.panellist` and keyed `main` slot. It does not replace root, chat, branding or approvals. The only Client runtime import is Host-provided React. Public session, command, input and navigation services connect the workflow.

1. User checks status: create/retain a dedicated session and execute `/qcu-market status` without submitting a model message.
2. User prepares: Host downloads only the compiled pinned release from `http://192.168.1.68:8080/plugins/<immutable filename>`. This local candidate has **not been published** there. Unavailable Hub means an error, never an installation claim.
3. Host requires exact origin/path, manual redirects, HTTP 200, identity encoding, exact content length (max 1 MiB), streamed byte limit and SHA256. Timeout is 30 seconds. Cache is `~/.cache/qcu-market`; owned directory/file checks, no-follow file open, 0400 immutable link and atomic partial cleanup protect the artifact. Cache stays available for the official file dependency.
4. Client sets a draft in the dedicated session and navigates to it. Existing draft, attachments, queued input or submission blocks overwrite. **No submit call, no automatic model consumption.** User sends the request. Official `plugin_manager` handles listing, disabled installation and separately approved activation; no QCU management RPC exists.
5. Recheck requires exact installed version, enabled bundle, exactly one enabled active row and the winning session skill's exact provider and body hash. Installation alone is not success. Restart requirements are explained, never performed automatically.
6. Only verified ready state offers a learning task draft. User sends that too.

Host command and agent tool share four operations: `status`, `prepare`, `verify`, `cancel`. No URL/path/install arguments. Prepare and verify require read-only or workspace-write session policy; full-access is refused because official management may skip per-call approvals in that mode. QCU never changes policy. The generated request is a model instruction, not an enforced transaction: actual official tool calls and approvals remain visible and must be checked in the live pilot.

Compared with pilot.2, this version adds **Host execution, fixed LAN download, persistent package cache, session creation, command/tool registration, package and skill status inspection and draft writing**. These are material permissions, not merely visual changes. It does not read credentials, chat history or student data. Code executes in the Host and is not risk-free. No App/profile has been updated by the local build.

Build: `node hub/plugins/qcu-market/build.mjs`. Run stdlib tests with `node --test tests/qcu-market.test.mjs tests/qcu-market-loop.test.mjs`. Official tests need the locally audited rc.2 dependency tree; see `docs/qcu-market-learning-loop.md` for repeatable setup and live pilot boundaries.
