# QCU Course Studio bounded generation candidate 1.2

2026-10-19 · Task `QCU-COURSE-BOUNDED-GENERATION` · local candidate `0.1.0-pilot.1.2`, wire protocol **2**. Store format remains 1. No deployment, release pins, published archives, global model settings or main README changes.

The 1.1 retest reported `max-tokens` at output budget 12000. Its character/chunk counters can count deltas and block ends and are not actual token usage. This candidate reduces per-call reasoning where supported and requests concise complete output. It does not establish the cause of the original 1.0 failure or prove a real-model fix.

## Effective policy and consent

The host reads the official exact-route `llm.resolveModelInfo(provider, model, signal)` metadata. It selects exact `low` when advertised, otherwise exact `off`, otherwise omits the request effort and uses the adapter default. UI text distinguishes the default's advertised effort from an unspecified default. Missing, failed or invalid metadata produces a fixed unavailable state and disables new generation; raw provider errors and descriptive metadata are excluded. Lookup and official preparation are cancellable, including adapters that ignore cancellation.

A shared bounded policy contains only `effort` (`low`, `off`, `default`), sorted unique `supportedEfforts` (up to 32 ids of 1–80 alphanumeric/underscore/hyphen characters), `defaultEffort` (supported id or null), and fixed `outputBudget: 12000`. The selected policy must follow the low/off/default priority. Provider/model strings retain their existing 200-character bounds. Unknown fields, invalid efforts and different budgets are rejected.

Before sending, Chinese/English UI displays provider/model, effective reasoning policy and output budget. Consent binds these facts, lesson input, references, workspace and course. Changes immediately disable generation; reconnect and connection reset never generate. The controller separately retains the confirmed route. Existing save/cancel/install/enable flows remain independent.

The host compares confirmation against fresh metadata at dispatch. After the durable running checkpoint, generation compares again. Official `prepareCall` then binds the adapter registration/defaults for one use; its resolved effort and output budget must equal confirmation. A final full metadata/route comparison precedes `prepared.stream`. This uses the official prepared streaming entry rather than the ordinary `llm.stream`, whose internal additional metadata resolution could otherwise change a default after the plugin's check. Default-mode requests omit `reasoningEffort`; any advertised default is materialized by the official runtime. No raw provider parameters, global overrides, alternate efforts, fallthrough or automatic retries are added. Adapter-generation rejection is final.

New task fingerprints and persisted model routes include canonical policy. Old provider/model-only stored routes remain readable, without fabricated policy or regeneration. Store format and strict draft acceptance are unchanged; protocol 2 requires matching new Host/Client for new confirmations. A client-supplied internal `request.route` is rejected; only the host supplies it after validating `expectedModel`.

## Bounded complete output

The prompt requests exactly 3 intentions and 3 criteria, at most 6 vocabulary entries and five stages totaling the requested minutes. Only selected component instructions are included: PPT/flipbook/cards have at most 6 slides/cards; other components at most 3 sections; worksheet at most 4 questions with compact worked teacher key; exit ticket at most 2 questions plus short rubric; interactive quiz exactly 3 questions with 4 options and worked explanations. Each exported component must be self-contained, including the questions/examples it needs and its own concise full worked answers or teacher key; required content cannot depend on another exported component. Only unnecessary lesson prose is de-duplicated. Sequence may refer to component question ids, and interactive quiz usage guidance may refer to its own quiz data.

A typical four-component JSON draft targets at most 14000 characters as an instruction. Actual topic-specific content, full mathematical answers, bilingual fields, teacher-verification markers, exact timing and all selections remain required. Larger sets may require the teacher to choose fewer components; nothing is silently deselected. References are passed intact. There is no response truncation, partial-JSON acceptance, or stricter legacy parser acceptance. The 120-second generation timeout, 12000 output cap, `tools: []`, output size limits and safe diagnostics remain in force.

## Changed files

Within `hub/plugins/qcu-course-workbench/`:

- `index.js`: cancellable metadata resolution, dispatch consent checks and official one-shot prepared generation.
- `src/protocol.mjs`: version/protocol, bounded policy/route parsing, comparison and bilingual labels.
- `src/store.mjs`: policy fingerprints/persistence and safe policy failure codes; old stored routes.
- `src/controller.mjs`, `src/view.mjs`: confirmed-route guard, displayed policy/budget and consent invalidation.
- `src/prompt.mjs`: selected-only bounded complete-output instructions.
- `package.json`, `pack.py`, `README.md`: candidate 1.2 identity and behavior.
- `preview.mjs`: synthetic preview follows protocol 2 confirmation with explicit synthetic metadata.
- `client.js`: rebuilt lazy-CJS client.

Tests: `tests/qcu-course-core.test.mjs`, `tests/qcu-course-client.test.mjs`, `tests/qcu-course-official.test.mjs`. This document is new. The supplied task draft remains untouched. Market/catalog/source pins and `tests/qcu-course-market.test.mjs` still refer to immutable published 1.1 source; they are not repointed at this worktree.

## Offline validation and pending acceptance

Using the existing audited dependencies (no installation/network/credentials/real model):

```sh
rtk proxy node hub/plugins/qcu-course-workbench/build.mjs
rtk proxy env QCU_OFFICIAL_DEPENDENCIES=/Users/mcq/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source node --experimental-transform-types --expose-internals --experimental-loader ./tests/support/feishu-official-loader.mjs --test tests/qcu-course-core.test.mjs tests/qcu-course-client.test.mjs tests/qcu-course-official.test.mjs
rtk proxy git diff --check
```

Before the standalone-export review correction, the build succeeded and **56 tests passed** (20 core/client and 36 official-runtime tests including subtests). The actual rebuilt client is rendered with React in both languages; policy/budget precede consent, changed provider/model/policy or connection reset invalidates it, and unavailable policy disables generation. Synthetic adapters under the actual official LlmRuntime verify low/off/default routing, omission of explicit effort for default mode, metadata/default changes at dispatch/pre-stream/preparation/final check causing zero generation calls, malformed policy rejection, cancellable lookup/preparation, exactly one adapter call for completed or failed model streams, diagnostics, reload, cancellation and no partial draft. Core tests cover policy idempotency/persistence, old route readability, selected-only prompt bounds, reference preservation and unchanged draft acceptance.

Review correction `QCU-COURSE-BOUNDED-REVIEW`: removed the global instruction to place each question/answer in only one location. The prompt now requires every independently exported component to contain its needed questions/examples and its own concise full worked answers/teacher key. The existing prompt test explicitly asserts this standalone contract, the permitted sequence/own-quiz references, and absence of the old cross-component answer de-duplication instruction. All concise size bounds and selected components remain required. This follow-up changes only `src/prompt.mjs`, `tests/qcu-course-core.test.mjs` and this document. The prompt is host-only and is not included in `build.mjs`, so no client rebuild is needed.

Impacted checks after this correction: **13 core tests pass**, the **1 selected official Host generation check passes** with its synthetic adapter, and `git diff --check` passes. The full 56-test result above belongs to the preceding implementation checkpoint, not a full-suite rerun after this correction.

```sh
rtk proxy node --test tests/qcu-course-core.test.mjs
rtk proxy env QCU_OFFICIAL_DEPENDENCIES=/Users/mcq/Documents/Codex/2026-09-30/task-7/host-lifecycle-mac/source node --experimental-transform-types --expose-internals --experimental-loader ./tests/support/feishu-official-loader.mjs --test --test-name-pattern='official Host registers namespace' tests/qcu-course-official.test.mjs
rtk proxy git diff --check
```

Parent still owns independent review, screenshots, fresh 1.2 archive checks/packaging and any later publish/deployment decision. Native DSH consent/reconnect behavior, actual model token behavior and completion quality, teacher review and target Office use remain pending. Concise prompts are advisory; larger component sets and adapters with unspecified or high default reasoning can still exhaust the unchanged budget. This candidate is locally implemented and offline verified, not deployed or real-model accepted.

## 父线程独立复核与候选包

修正独立导出完整性后，父线程从新 TGZ 提取 Host/Client，连同 core/client 与已发布 1.1 的市场契约执行，**59 项通过、0 失败、0 跳过**。市场归档契约仍核验不可变 1.1，不代表市场已指向 1.2。13 个普通归档成员逐项匹配最终源码，禁止重复、链接及路径穿越；默认禁用，无新增依赖或安装脚本。

候选版本 `0.1.0-pilot.1.2`，51089 字节，SHA256 `88a55b22561a5f6cf1e7af8d27ad28d074df13db4feb4c9340fddd208f5ad0ec`。产物位于 `/Users/mcq/Artifacts/qcu-harness/0.1.0-course-workbench.1.2/`。已发布工作台 1.1、市场 P12.2 的字节数和摘要复核未变。

从既有官方应用 ASAR 核对 dsh-llm 与 dsh-llm-deepseek 的 lib/index.js，均与测试依赖逐字节一致；官方 LLM 确含 prepareCall 和 resolveModelInfo。未修改官方源码。

Chromium 对实际共享 React 页面执行合成输入和确认流程，low/off/default/unavailable 四类状态、1120/360 CSS 像素、暗亮主题共 16 张截图。预算和策略显示、未确认禁用、确认后可生成、策略变化立即失效、只读重连通过；页面异常、外部请求和生成调用均为 0。已目视检查宽屏亮色与窄屏暗色，窄屏标题沿用既有换行，未额外改版。检查脚本先因工作区不是 label 而定位超时，修正为实际 combobox 后通过，未修改业务源码来消除脚本问题。

本轮没有真实模型调用，未发布 Hub、未更新 mini。提示词篇幅限制是指引，不能保证真实模型必然完成。仍需安装新候选后，核对并确认模型、推理档、12000 预算及发送资料，再做一次真实复测；成功后才继续预览、修订、独立确认保存及目标 Office 检查。旧失败不删除、不重写，无自动重试。
