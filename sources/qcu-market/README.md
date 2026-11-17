# 工具市场 Client 源码

当前入口为 client-shell.js 与 hub/plugins/qcu-market/src/capability-library.mjs；运行 scripts/build-market-library.py 生成 client.js。shell 保留现有状态机与宿主接线，library 维护工作助手。不要以生成产物作为构建输入。旧版分模块源码可从 rc4.4.2 标签读取；不可混用旧 build.mjs 覆盖新版客户端。
