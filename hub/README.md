# 城院 Skill 目录站

保留本机目录站的产品源码，不含学习资料、内部计划、已部署环境或安装包。默认示例目录站改为 http://127.0.0.1:8080；跨机器使用时显式设置 CHENGYUAN_CATALOG_URL。运行 home、模型密钥均由用户本机配置。

Skill 唯一源码位于 ../skills；scripts/batch-publish-skills.sh 按此路径构建。插件源码在 plugins/chengyuan-skill-installer。data/catalog.json 暂为 draft，data/skills 和 data/plugins 的 ZIP/TGZ 在审查发布前重建且不提交 Git。部署脚本会操作 Docker 或系统软件；本次仅检查语法，未执行部署或安装。

未来将官方 QCU Office Bundle 上架此目录站还需安装链及兼容性验收，不能把旧安装器的单测等同这一链路已完成。
