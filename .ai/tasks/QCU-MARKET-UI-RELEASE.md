# QCU-MARKET-UI-RELEASE
用户已批准改版并明确授权推送开发分支、部署现有Hub和mini。这里仅准备源码发布身份，不部署。
将当前已验收 UI 打为 0.1.0-pilot.11.1。只修改 qcu-market package.json、src/remote-contract.mjs 的 version、pack-pilot.py 允许版本、插件 README 当前版本和 tests/qcu-market* 中明确断言当前版本的值。运行 build.mjs 生成 client.js，保持构建产物一致。不要全仓替换历史文档版本；不修改 catalog、协议4、业务流程、Hub网站或权限。保留14文件打包、默认禁用、原依赖约束。
直接实现，无须再调用 Codex 或其他代理。不提交不推送不部署，不安装依赖。运行相关源码测试（无依赖的 qcu-market.test、teacher.test、tools.test 排除archive），报告变更与失败。归档/官方集成由父线程运行。不要耗时读取无关历史，任务范围仅版本身份。
