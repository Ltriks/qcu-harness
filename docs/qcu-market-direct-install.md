# QCU无模型确认安装：pilot.4

本版接通的是自有明确确认界面 + 官方公开安装服务，**没有修改DSH源码，没有复用私有安装控制器，也不需要模型或API Key**。官方UI用户点击的安装路径与agent工具的模型turn审批路径不同；先前3.1对话桥接不再是推荐试用路线。

## 已实现的单条流程

固定条目 `qcu-study-coach@0.1.0-pilot.2` → 按需下载独立Hub包 → 校验长度/哈希 → 官方inspect → 展示来源、名称、版本、SHA256及权限风险 → 用户明确确认 → 再校验和检查实例/registry未变 → 官方安装 `enabled:false` → 观察精确版本已安装且未启用。

启用包、启用精确组件分别展示确认；不自动授权build脚本、不加版本豁免、不改权限、不自动重启、不自动发学习任务。组件active仅展示组件已加载，不冒称目标会话技能可用。示例复制有实际失败反馈。

市场包仅包含条目/代码，不内嵌教练TGZ。目录本次未发布到Hub，现场未部署，点击下载可能404。旧版教练仍会明确报冲突，本版不提供自动升级/卸载。

## 公开接口证据

官方基线 `639ed015397290b3745d163aafe02ffee4aa3f84`：

- `packages/client/ui-plugin-manager/src/client/PluginManagerPage.tsx:890`：风险文字与用户安装按钮。
- `packages/client/ui-plugin-manager/src/client/manager-store.ts:873`：inspect后使用官方installBundle，`enabled:false`、requestId、registry；取消、waitForInstall和未知结果处理见同文件后续方法。
- `packages/boot/plugin-manager/src/index.ts:461`：公开安装方法；574、584：结果等待与取消。取消只有进程退出和文件恢复后才确认；too-late/not-running不能称取消。
- `packages/typert/protocol/src/types.ts:424`：公开Client `$mount`契约；Typert注册表与Gateway支持显式严格描述符。
- 自有传输：`hub/plugins/qcu-market/src/remote-contract.mjs`，仅三个UUID参数接口；Host通过公开TypertRemoteService/registry挂载。无会话和工具注册。

本版不冒用官方Agent审批弹窗。授权发生在QCU确认界面的本机用户点击，由官方管理服务执行。确认动作没有agent工具入口。其他已安装可信代码仍有应用进程权限，这不是隔离恶意插件的安全边界。

## 相对3.1的权限差异

| 项目 | pilot.4 |
|---|---|
| 模型、API Key、会话 | 安装链路完全移除；不建会话、不读写聊天草稿、不读权限模式 |
| 技能正文 | 不再读取或做会话provider判断 |
| QCU Host | 仅下载、固定缓存读写、限时收据；无管理/技能/commands/tools依赖 |
| 客户端读取 | 点击后调用官方bundle清单；已启用精确包才读取组件清单，都是profile级元数据后本地筛选 |
| 安装与启用 | 新增用户确认后的公开官方调用；安装默认禁用，包和组件启用各独立确认 |
| 网络 | QCU自身只固定LAN包源；既有Host连接订阅进度；官方安装还可能访问配置的registry/镜像 |
| 写入 | QCU只专用cache；官方安装另写profile manifest/lock、依赖、缓存、日志，影响同profile全部会话 |
| 权限本质 | Host运行于应用用户权限；实现限制，不是OS沙箱；不隐式增加build许可或版本豁免 |

## 验证边界和复现

测试分四组：历史目录回归、固定源/下载/确认/取消/状态机模拟、确认组件行为、官方真实Cordis/SlotRegistry/Layout/Client Gateway/Host Gateway/SkillRegistry与tarball解析。真实管理操作均由假的manager实现；不运行pnpm或修改真实profile。模拟覆盖：拒绝/取消/双击/重入、source/hash/expiry/registry/实例变化、检查失败、脚本待授权、回包丢失、取消抢在任务接收前、取消过晚、独立启用、组件ID变化、重启返回和释放。

尚未测试：真实Mini运行、实际Hub服务传输、真实安装/取消/启用/HMR/重启、视觉人工验收、真实教学模型效果。当前实例公开服务挂载及部署peer兼容性仍须现场只读预检，不由模拟测试代替。

```sh
node hub/plugins/qcu-market/build.mjs
python3.11 scripts/pack-coach-v2.py --out /tmp/qcu-coach-check
python3.11 scripts/prepare-market-loop-tests.py --dependencies "$QCU_OFFICIAL_DEPENDENCIES" --coach /tmp/qcu-coach-check/qcu-study-coach-0.1.0-pilot.2-4ac9b2489ece90098faea5f5d0cf79c6efb2989214eaf74f4e38c4841c2eb060.tgz
node --test tests/qcu-market.test.mjs tests/qcu-market-loop.test.mjs tests/qcu-market-direct-ui.test.mjs
node --experimental-transform-types --test tests/qcu-market-official.test.mjs tests/qcu-market-host-official.test.mjs
python3.11 hub/plugins/qcu-market/pack-pilot.py /tmp/qcu-market-pilot4
```

## 待另行授权的真机最短计划

1. 只读核对目标profile、rc.2版本、公开Remote及已有教练版本；有旧教练冲突时停，另明确其卸载处理，不自动覆盖。
2. 在校内Hub只新增固定哈希教练包/目录，回读校验，不动旧文件。通过官方UI安装固定pilot.4市场包并显式启用其Host行；这是新增管理UI能力，不能按纯视觉更新授权。
3. 首次打开确认：核对名称、版本、来源、hash及联网/文件写入范围。先拒绝一次，查无安装；再重新准备，用户确认一次。验收双击仅一次，安装后保持未启用。
4. 用户分别确认包和组件启用。需要重启则用户正常重启；再查组件状态，不以active代替技能调用验收。
5. 用户自行复制/发送合成学习任务，确认真实技能调用与时间建议。该学习步骤才需要模型；不读取用户密钥或既有聊天。
6. 任一不明结果停在“未确认”，通过官方任务/插件详情核对，不自动重装、授权脚本、加豁免或扩大权限。
