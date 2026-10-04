# 父进程生命周期修复验证（2026-10-04）

基础提交：`756b7331b2eaf91aff5340c62cedaf5261af7876`。从公开仓库新 clone 开发，未用旧 ZIP 代替主线。官方 baseline、依赖锁及协议版本未升级；网页反馈三文件与导入主线一致。

环境：Linux x86_64、Node 24.19.0、pnpm 11.7.0、Python 3.12.14、TypeScript 6.0.3、Vitest 4.1.8。测试均为合成输入、临时目录和自有子进程，不调用模型。

## 前后证据

- 旧提交实际 QcuService→Python：强杀 Node Host 后 0.8 秒，认证探针仍返回 400，两个服务记录仍在。测试独立自清理定时器结束了故意残留的进程并回收，无按记录 PID 终止行为
- 修复后相同场景：一次观测为 0.220 秒内 Python 退出 0，原监听关闭，自己的 lock/bridge 删除；测试还验证同目录重新启动
- 15 项 Python 子进程测试覆盖启动前 EOF、实际读错误、无指令含义的数据、卡住启动/服务循环、未完成 HTTP 请求、处理中退出、已有活实例、记录替换、旁系进程以及真实 Host SIGKILL。当前 Linux 无跳过；Windows 的 POSIX 观测套件显式跳过，不能据此宣称 Windows 已通过

## 结果（互不重复的顶层测试分组）

| 分组 | 通过 |
| --- | ---: |
| 官方受影响源码及原有策略/启动测试 | 403 |
| 官方真实构建 profile/Loader/卸载/重载/安装路径 | 14 |
| 构建后的固定入口测试（替代 Electron，不是 GUI） | 5 |
| 外置 Host | 69 |
| 外置 native 合约/私有 IPC | 119 |
| Client 控制器及真实构建工厂 | 28 |
| 网页完成反馈 DOM | 11 |
| Python 引擎及临时服务 | 11 |
| 通用 Skill（导入基线，源码未改） | 20 |
| Hub 模拟目录安装器（导入基线，源码未改） | 5 |

Host 的 69 项包含一个编排测试，该测试内部运行上述 15 项 Python 子用例；不要把编排和子用例重复累计。旧的 focused/baseline 重跑同样不叠加。所有本轮分组通过，无 Linux 平台跳过。

完整官方 Host tsc 与 workspace tsdown、Client tsc 与 Client tsdown、Desktop 叶级类型/打包均通过；外置包构建和 Host/native/Client 三项类型检查通过；改动 TypeScript 使用官方 Oxlint 配置及入口通过。首次直接调用缺少 tsgolint 的工作目录解析，改用官方脚本从匹配 checkout 执行后通过，未禁用规则。普通更新、固定入口、两工具和 28 项限制测试保持通过。实际 CLI 安装/原生交接测试使用新打包的 runtime，模型请求计数为零。

## 全新重建发现并修复的缺口

仅构建 Host 时，业务 Client 类型缺少官方 `./client` 声明；按官方流程构建 Client 面，而不是改业务类型规避。完整 Client 聚合进一步发现 TS6307：根 `tsconfig.client.json` 没有列出 ipc.ts 新引用的 `qcu-native-contract.ts`。现只增加该文件条目，补入累计 patch/source slice 并更新补丁哈希；随后完整 Client 构建通过。新目录再次严格应用累计补丁并逐字节核对 source slice 通过。官方生产运行源码的 16 文件统计不变，新增的是一项构建配置修正。

## 复现命令与日志

先遵循 [REBUILD](REBUILD.md)。本轮重建目录为仓库忽略目录 `.work/rebuild`，官方为 `upstream`，业务包为相邻 `package`。在官方目录用冻结 pnpm 锁安装，再运行：

- `pnpm run build:lib:host`
- `pnpm run build:lib:client`
- `pnpm --filter @deepseek-ai/dsh-desktop run build`

在业务包运行 `node scripts/link-development.mjs ../upstream`、`npm run build`、`npm run typecheck:host`、`npm run typecheck:native`、`npm run typecheck:client`。真实 Python 测试显式设置 `QCU_SERVICE_PYTHON` 为解释器绝对路径，`QCU_SERVICE_REAL_SERVER` 为当前 `runtime/server.py` 绝对路径，再运行 `npm run test:host`；其余为 `npm run test:native`、`npm run test:client`、`node --test tests/web.test.mjs`、`python3 -B -m unittest discover -s tests -p test_workbench.py`。

真实 CLI 安装 fixture 仍使用原候选的相邻目录布局和固定临时 TGZ 文件名。按当前源码执行 `npm pack --ignore-scripts --cache <隔离缓存> --pack-destination ..`，创建 `.work/rebuild/verification`，并为 fixture 准备 `.work/qcu-task-providers/tooling/node_modules/.bin/pnpm` 与 pnpm-store。该包只作本地测试，不是同版本发布。没有引入跨 checkout 的运行时 node_modules 链接。

准确逐项官方测试命令和输出保留在 `.work/upstream-logs/VALIDATION.md`；基线记录在 `.work/baseline-logs/SUMMARY.md`，最终包结果在 `.work/final-business-logs`。这些是本地忽略的执行记录，不会随源码推送。源码中的测试与固定重建输入承担可复现性；并未建立 CI/发布流水线。

## 仍未认证

Mac/Windows 实际异常退出及新 GUI、系统文件选择/下载/打印、安装共存、签名、更新、真实 profile 与数据迁移/回退均需另行验收。旧活孤儿服务不自动清理；同权限代码、句柄复制及文件竞态不受 OS 沙箱保护。详见 [生命周期限制](HOST-LIFECYCLE.md)。
