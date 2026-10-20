# 本机 Hub 投稿审核

独立于只读 `hub/release/serve-hub.py`。Python 3.9+ 标准库、原生 JS/CSS，无安装步骤。只监听精确 IPv4 `127.0.0.1`，不能改成 LAN、IPv6 或通配地址。

从仓库根启动（`--init` 要求状态目录**不存在**，且其父目录已经存在）：

```sh
rtk proxy python3 hub/admin/server.py --state-root /private/tmp/qcu-hub-submissions-local --init --port 8765
```

重启同一状态库，去掉 `--init`：

```sh
rtk proxy python3 hub/admin/server.py --state-root /private/tmp/qcu-hub-submissions-local --port 8765
```

打开 `http://127.0.0.1:8765/`。终端只打印私有凭据**文件路径**及本机入口，不打印令牌。用本机编辑器读取该目录的 `credentials.json`，分别使用 `submitter` / `maintainer` 值进入两种角色。不要复制到聊天、URL、截图或日志；退出／刷新后需重新输入。停止服务用 Ctrl-C。

状态根与祖先必须为真实目录，根目录权限0700、凭据0600；拒绝当前仓库、`/Users/mcq/Repos` 下的所有工作区、含 Git 工作区祖先、含 `manifest.json` 与 `catalog.json` 的公开快照祖先或上述目录的父目录。不要把私有状态目录交给其他文件服务器。`/private/tmp` 适合验收，可能被系统清理；长期保存请使用仓库外、未被同步或公开服务托管的专用新目录，定期私有备份，勿另启进程操作同一状态库。

投稿者选择**一个完整 handoff 文件夹**（支持 `webkitdirectory` 的 Chromium），不需要自行解压。客户端仅去除一层公共选中文件夹前缀，服务端独立复验全部路径／字节；原文件夹不变。维护者查看队列、下载检查报告和原始附件，填写理由后退回或逐项确认并批准。本机批准后还必须查看精确候选预览、勾选确认并点击“生成发布候选”。没有真实 Publish 按钮。

边界、状态、产物、测试和人工验收见 [MVP 说明](../../docs/qcu-hub-submissions-mvp.md)。本地令牌只是两个能力角色，不是组织登录或真实用户身份；这是本机准备工具，未部署、未发布、未授予安装权限。
