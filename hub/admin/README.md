# 本机 Hub 单管理员审核

P15 已加入可选的独立签名发布与公开下载复核，配置、首次迁移及部署边界见[实施说明](../../docs/qcu-hub-market-publication.md)，人工步骤见[中文验收单](../../docs/qcu-hub-market-publication-acceptance.md)。不配置发布能力时仍只生成本机候选。P15.1 已按用户授权部署；真实账号由用户在 mini 本人设置，当前入口、代码/状态位置及恢复命令见 [部署验收](../../docs/qcu-hub-market-p15.1-deployment.md)。

Python 3.9+ 标准库、原生 JS/CSS，无安装步骤；独立于只读 `hub/release/serve-hub.py`，仅精确 IPv4 `127.0.0.1`。固定账号 `qcu-admin` 在一个页面／会话中导入同事 handoff、退回／批准、单独确认生成本机候选；无同事账号、注册或匿名投稿。

本人在本机 TTY 设置密码（新状态目录须不存在，父目录已存在）：

```sh
rtk proxy python3 hub/admin/server.py --state-root /private/tmp/qcu-hub-single-admin-local --init --port 8765
```

隐藏输入两次12–128字符密码，无默认值、不接受密码参数／环境变量。打开 `http://127.0.0.1:8765/` 登录。Ctrl-C 停止后，普通重启：

```sh
rtk proxy python3 hub/admin/server.py --state-root /private/tmp/qcu-hub-single-admin-local --port 8765
```

忘记密码时，**停止该状态库的服务**后本人运行（先独占锁，再隐藏输入；保留全部业务数据）：

```sh
rtk proxy python3 hub/admin/server.py --state-root /private/tmp/qcu-hub-single-admin-local --reset-admin-password
```

私有根0700、`admin-auth.json`0600，只有随机盐和PBKDF2-SHA256600000次哈希及有界认证元数据；拒绝链接、不安全目录、仓库／工作区与公开快照目录。不要通过其他服务器暴露状态；`/private/tmp`可能清理，长期状态使用仓库外未同步／未公开的专用目录并私有备份。

页面立即清空密码，会话仅在页面／服务RAM、最多16个、8小时过期；刷新／重启须重新登录，退出撤销服务会话。60秒5次失败后限流；401不自动重发操作。所有数据接口需登录。单账号仅为本地 principal，不建立同事真实身份或不可抵赖性。

schema 1 双角色旧库固定报 `store.legacy_state`，不改字节、不采纳旧凭据；继续用旧分支。旧体验和验收保留在 [历史 MVP](../../docs/qcu-hub-submissions-mvp.md)。本轮实现、命令、22项回归与真实 Chromium 合成验收、截图及未测边界见 [单管理员说明](../../docs/qcu-hub-single-admin.md)。

上传不批准、批准不生成候选；需另行预览并确认。候选未发布、市场不可自动安装。管理员仍只支持本机回环，MacBook 可经已有 SSH 隧道访问；不开放局域网写接口。当前已部署状态见上述 P15.1 记录，下面初始化/恢复命令仅用于受控维护。
