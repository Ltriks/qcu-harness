# 城院 Skill 目录站

当前 .68 局域网学习教练固定包已发布，用户确认条目可见且可下载。新版可复制官方安装/启用/调用指令与 HTTP 剪贴板降级已在开发分支准备，**尚未发布**；见 [安装体验、短指南与两文件发布白名单](../docs/HUB-INSTALL-EXPERIENCE.md)。不自动安装，也不把下载当安装验收。下文旧准备记录保留其历史范围。

保留本机目录站的产品源码，不含学习资料、内部计划、已部署环境或安装包。默认示例目录站改为 http://127.0.0.1:8080；跨机器使用时显式设置 CHENGYUAN_CATALOG_URL。运行 home、模型密钥均由用户本机配置。

Skill 唯一源码位于 ../skills；scripts/batch-publish-skills.sh 按此路径构建。插件源码在 plugins/chengyuan-skill-installer。data/catalog.json 暂为 draft，data/skills 和 data/plugins 的 ZIP/TGZ 在审查发布前重建且不提交 Git。部署脚本会操作 Docker 或系统软件；本次仅检查语法，未执行部署或安装。

未来将官方 QCU Office Bundle 上架此目录站还需安装链及兼容性验收，不能把旧安装器的单测等同这一链路已完成。

局域网阶段的新准备入口见 [目录分发与 Mac mini 迁移准备](../docs/HUB-LAN-DISTRIBUTION-PREP.md)：release/catalog.mjs 校验、固定哈希下载及新目录stage，release/serve.mjs 提供显式只读服务。未部署到目标机，不执行历史部署脚本或改动原fixture。最新独立对话安装试验已由第二台用户人工通过，见 [验收证据](../docs/evidence/hub-dialogue-second-mac-user-acceptance.json)；不等于正式目录上线。
