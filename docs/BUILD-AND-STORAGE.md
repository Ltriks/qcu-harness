# QCU Buddy 构建与本地存储

当前源代码分支 `fix/qcu-windows-rc451`，主要工作树 `.work/release-rc45`。完整交付版本为4.5.6/rc45.7，双端最终ZIP仅保留主仓库 `releases/0.1.0-rc.4.5.6/` 一份。分支中的 `releases/` 只保存说明和验证元数据，ZIP不进入Git。

## 保留项

- 完整源码、全部Git分支和工作树，以及未提交的其他任务。
- 最新双端ZIP及SHA256、安装说明、验收记录。
- **必要构建输入**：主仓库 `.local/build-inputs/rc455/` 的两份4.5.5 ZIP，共802,017,098字节。其摘要见 `release/rc456/build-inputs.json`。它们不是额外安装版本；当前构建器严格依赖这些原始字节，迁移电脑时需另行复制。未发布到公开GitHub，不可在没有替代来源前删除。
- 私有验收回执、截图、脚本、精简升级基线。真实账户、密钥、对话、教师资料及应用安装目录不属于清理范围。

## 重建

在源代码工作树先运行 `node hub/plugins/qcu-branding/build.mjs`。使用全新的stage，避免覆盖已交付ZIP：

```sh
python3 scripts/build-rc456.py stage --target mac-arm64 --base ../../.local/build-inputs/rc455/QCU-Teacher-0.1.0-rc.4.5.5-mac-arm64.zip --stage .work/rebuild-mac
python3 scripts/build-rc456.py pack --target mac-arm64 --stage .work/rebuild-mac --out .work/rebuilt/mac-arm64
python3 scripts/build-rc456.py stage --target win-x64 --base ../../.local/build-inputs/rc455/QCU-Teacher-0.1.0-rc.4.5.5-win-x64.zip --stage .work/rebuild-win
```

Windows stage后，必须在Windows中执行 `release/rc456/compile-launcher.ps1 -Stage <stage路径>`，从stage生成的Launcher.cs及仓库ICO编译启动器，再执行：

```sh
python3 scripts/build-rc456.py pack --target win-x64 --stage .work/rebuild-win --out .work/rebuilt/win-x64
```

依赖Python3、Node.js；Mac需Xcode命令行工具（clang/codesign/ditto），Windows需.NET Framework编译器。生成的新包需做原生与GUI验收，不能沿用旧包的签名摘要与测试结果。后续版本需要明确更新版本、构建标记、旧seed白名单、云端构建白名单和输入摘要；不能直接覆盖现有版本ZIP。

清理仅移除可再解压的应用/运行时、旧安装ZIP、缓存和明确的隔离测试目录；源代码、原始资源及小型验证报告保留。审计清单位于主仓库私有 `.local/qcu-cleanup-20261120/`。旧交接中指向已清理解压目录的路径属于历史证据，不再代表文件仍在本地。
