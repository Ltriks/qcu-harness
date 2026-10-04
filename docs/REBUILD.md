# 重建与验证

来源版本、官方 commit、累计补丁及锁文件由 upstream/baseline.json 固定；候选文件 SHA256 及迁移映射在 IMPORT-SOURCES.json。不使用旧 r5 累计补丁覆盖本候选。

准备官方仓库的全新固定 commit checkout。scripts/reconstruct-upstream.py 的 --baseline 指向该 checkout，--out 指向不存在的新目录。脚本仅创建本地克隆、应用并核验补丁、复制外置包到匹配 package/upstream 布局；不安装、启动或更改输入工作树。三个跨包集成测试保留候选的相邻布局，因此应从重建后的 package 运行完整 Host/native 测试，而不是直接从 monorepo 路径运行它们。

在重建 upstream 中使用锁定 pnpm 11.7.0 和冻结锁文件，按照官方 README 构建依赖与本机原生 addon；本次迁移未重新安装依赖。package/scripts/link-development.mjs 仅链接匹配官方开发依赖，不是插件安装器。随后运行 package 的 build、三项 typecheck 及 test:host、test:native、test:client。真实服务用例必须明确提供 QCU_SERVICE_PYTHON 和 QCU_SERVICE_REAL_SERVER，否则相应跳过不可算通过。

官方重建范围包括 packages/boot/app-boot、apps/cli、apps/desktop-host 和 apps/desktop。保留累计补丁中的原生、策略和真实进程用例。安装产物、源码 clone、node_modules 和生成 lib 留在忽略目录，不提交本仓库。专用入口的构建检查不代替签名、原生 GUI、安装或发布验收。

无需模型的局部回归：packages/qcu-thesis-workbench/tests/web.test.mjs、tests/test_workbench.py、Client 两组测试，仓库 tests/test_skills.py，以及 hub/plugins/chengyuan-skill-installer/test/install.test.mjs。Python 使用标准库；DOM 测试复用锁定 jsdom。scripts/build-skills.py 在新的 --out 目录生成三项 QCU draft 包；hub/scripts/batch-publish-skills.sh 从唯一 skills 源目录生成其他包。不要在此阶段执行 Docker 部署或系统软件引导脚本。

公开检查运行 scripts/verify-public-source.py；扫描结果不显示命中的值，合成拒绝输入单独分类，实际敏感命中阻止通过。新增输出后重新审查来源、许可证、大小与敏感信息；推送另行确认。

累计补丁中的空白上下文行须保留单个空格前缀。.gitattributes 仅对 upstream/qcu-office.patch 的此类行尾空格设定例外，其他源码仍使用正常空白检查；补丁 SHA256 与严格应用检查继续约束其原始字节。
