# 重建与验证

来源版本、官方 commit、累计补丁及锁文件由 upstream/baseline.json 固定；候选文件 SHA256 及迁移映射在 IMPORT-SOURCES.json。不使用旧 r5 累计补丁覆盖本候选。

准备官方仓库的全新固定 commit checkout。scripts/reconstruct-upstream.py 的 --baseline 指向该 checkout，--out 指向不存在的新目录。脚本仅创建本地克隆、应用并核验补丁、复制外置包到匹配 package/upstream 布局；不安装、启动或更改输入工作树。三个跨包集成测试保留候选的相邻布局，因此应从重建后的 package 运行完整 Host/native 测试，而不是直接从 monorepo 路径运行它们。

在重建 upstream 中使用锁定 pnpm 11.7.0 和冻结锁文件，按照官方 README 构建依赖与本机原生 addon；本次迁移未重新安装依赖。package/scripts/link-development.mjs 仅链接匹配官方开发依赖，不是插件安装器。随后运行 package 的 build、三项 typecheck 及 test:host、test:native、test:client。真实服务用例必须明确提供 QCU_SERVICE_PYTHON 和 QCU_SERVICE_REAL_SERVER，否则相应跳过不可算通过。

官方重建范围包括 packages/boot/app-boot、apps/cli、apps/desktop-host、apps/desktop 和 apps/web。依赖和本机原生 addon 准备后，优先在重建 upstream 运行官方 `pnpm run build`；固定基线的 scripts/build.ts 已包含 native-system、Host/Client 库和 Web 页面构建，再运行 `pnpm --filter @deepseek-ai/dsh-desktop run build`。仅为已完成大构建的局部恢复使用 `pnpm run build:web`，不重复完整构建。若显式分步构建，必须同时完成 `build:lib:host`、`build:lib:client` 和 `build:web`；只有 Host 构建会缺少 `./client` 类型声明，Host/Client 库及 Desktop 叶级构建本身也不生成 Web 静态页面。保留累计补丁中的原生、策略和真实进程用例。安装产物、源码 clone、node_modules 和生成 lib 留在忽略目录，不提交本仓库。专用入口的构建检查不代替签名、原生 GUI、安装或发布验收。

启动前从本仓库运行 `node scripts/verify-desktop-web.mjs --upstream <重建 upstream>`；官方开发入口准备好 runtime project 后，再加 `--runtime-project <已准备的 runtime project>`，检查 Host 与 Electron 实际 resolver 的前端 index。命令只检查文件并输出布尔结果，缺失或不可读时非零退出，不构建、安装、启动或认证。只检查 Host 时 `rendererChecked=false`，不能算 Renderer 检查通过。在已认证的初始页面请求返回 404 时，应检查静态产物，不能把后续 Host 清理或 welcome 错误当作模型密钥问题。实际 Mac 修复前后证据及 GUI 未验项见 [Mac 启动验收](MAC-STARTUP-VALIDATION.md)。

只读产物检查的合成回归运行 `node --test tests/verify-desktop-web.test.mjs`，不要求安装依赖或启动 Electron。

无需模型的局部回归：packages/qcu-thesis-workbench/tests/web.test.mjs、tests/test_workbench.py、Client 两组测试，仓库 tests/test_skills.py，以及 hub/plugins/chengyuan-skill-installer/test/install.test.mjs。Python 使用标准库；DOM 测试复用锁定 jsdom。scripts/build-skills.py 在新的 --out 目录生成三项 QCU draft 包；hub/scripts/batch-publish-skills.sh 从唯一 skills 源目录生成其他包。不要在此阶段执行 Docker 部署或系统软件引导脚本。

公开检查运行 scripts/verify-public-source.py；扫描结果不显示命中的值，合成拒绝输入单独分类，实际敏感命中阻止通过。新增输出后重新审查来源、许可证、大小与敏感信息；推送另行确认。

累计补丁中的空白上下文行须保留单个空格前缀。.gitattributes 仅对 upstream/qcu-office.patch 的此类行尾空格设定例外，其他源码仍使用正常空白检查；补丁 SHA256 与严格应用检查继续约束其原始字节。

## 版本与升级门槛

当前只验证固定 DSH `639ed015397290b3745d163aafe02ffee4aa3f84`（对应预发布 tag [dsh-v0.2.0-rc.2](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.0-rc.2)），不是兼容所有 0.2.x 的承诺。`upstream/baseline.json` 固定官方提交、累计补丁与锁文件哈希及本轮 Node 24.19.0、pnpm 11.7.0、Python 3.12.14；包内 `engines` 是声明的允许范围，不等于整个范围已测试。依赖由冻结锁文件和各包声明共同约束。

业务包、官方依赖与桌面适配应分别审查版本及兼容关系，不要求统一版本号或同时发布。升级 DSH 时另建升级分支，重新审查补丁接缝、官方工具与 Cordis 生命周期、Client slots/工厂协议、28 项禁用行及两工具 guard，再运行类型/构建、普通对话及功能回归、卸载/重载/异常退出和权限负向测试；Mac 原生 GUI 另行验收。不得自动跟随 latest 或绕过失败门槛。

升级前还须明确用户数据格式兼容、备份及可实际恢复的回退方案；Git 回退只能恢复源码，不能保证数据库或 profile 降级。当前没有建立自动升级流水线、数据迁移/回退系统、签名发布或合格更新源。普通更新器在固定 QCU 入口禁用；此处只是维护要求，不意味着这些发行能力已经完成。
