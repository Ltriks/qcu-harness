# QCU Mac rc4.4.2 源码归档与 GitHub 预发布

用户2026-11-11授权整理代码并发布 GitHub Release。仅普通推送独立分支 `dev/qcu-release-mac-rc442`（基于 `dev/qcu-release-archive-20261028`）及新增标签 `qcu-teacher-v0.1.0-rc.4.4.2-mac-arm64`；不合并／直接推送 main、不强推、不覆盖既有 Release 或标签、不部署 Hub 或 mini、不重置任何用户 Home。

## 修正内容（相对 rc44.1）

| 现象 | 根因 | 修正 |
| --- | --- | --- |
| 市场刷新一律 `QCU-MKT-OFFLINE`，终端 curl 却返回 200 | 旧代码把任何 `TypeError` 都归为离线；部分 Mac 上 Electron 进程对局域网地址得到 `EHOSTUNREACH`，独立 node 与 curl 正常，开启“本地网络”权限后仍复现 | 市场 16.4：只有网络类错误归 OFFLINE，另分 TIMEOUT／HTTP／FORMAT／SIGNATURE／CATALOG-EXPIRED／CLOCK／STATE／VERIFY；提示附阶段、HTTP 状态、代理标记、耗时；darwin 上遇 `EHOSTUNREACH／ENETUNREACH／EPERM` 时改用 `/usr/bin/curl --noproxy '*'` 获取同一签名目录，验签不变 |
| 已装 rc44.1 打开 rc44.2 报 `QCU-ST-1101` | 收据构建号不同即拒绝 | 同套件版本 0.1.0-rc.4.4 时只刷新受管组件（node_modules 与 .qcu-bundles），保留工作区、设置、Key 与可选组件；收据写 `refreshedFromSeedId` |
| 复制诊断按钮连环弹窗 | 启动器复制／导出分支缺少 `break` | 补 `break` |
| 诊断与上报“诊断服务暂不可用” | 主题硬编码构建号 `rc44.1` | 改为 `^rc44\.[0-9]+$` |

## 源码快照

`release/snapshots/mac-rc4.4.2/FILES.json` 逐文件绑定整包 SHA256：

- `components/`：从最终 ZIP 内 `.qcu-bundles/*.tgz` 原样解出的 11 项组件，共 118 个文件。与 rc4.3 快照相比，仅市场、主题变化，课程工作台移除，其余逐字节相同。
- `build/`：rc44 `build.py`、`Launcher.m`、`support/`（逐文件与包内 `Contents/Resources/support/` 比对一致）、`tests/`，以及市场测试 `market-tests/`。市场测试原位引用 `./extracted/package`，对应快照中的 `components/qcu-market`。

build.py 需要 rc4.3 原包、市场 16.4 tgz 及本机工具链，Git 克隆不能单独逐字节重建 ZIP；本次未为发布重建或重压缩安装包。ZIP 由 `ditto -c -k --sequesterRsrc` 生成，与 rc44.1 相同含 `__MACOSX` 附属条目（11,092 条）；解压后签名校验通过。

## 本次验证

- ZIP 395,927,817 字节，SHA256 `7fb571edbb1067553160e1e649741f61ea6a2f45156fd67ba890ae4e81cf966b`；20,852 成员、18,158 非目录项读取及 CRC 通过，14 符号链接均为相对目标，134 项种子文件摘要通过。
- 287 个非供应商成员及嵌套 TGZ 的密钥／私钥／凭据值／Bearer／用户 Home 路径模式扫描无命中；无真实 Home、Key、会话、私有反馈或日志。152 项许可文件单列 `LICENSES.zip`，附 QCU 与上游 MIT 原文。
- 用最终 ZIP 解压的 App，在内置 Electron 运行时（`ELECTRON_RUN_AS_NODE=1`）执行：

```sh
QCU_TEST_KIT="$APP/Contents/Resources" ELECTRON_RUN_AS_NODE=1 "$ELECTRON" --expose-internals -r "$APP/Contents/Resources/support/deny-network.cjs" build/tests/acceptance.cjs   # 7/7
ELECTRON_RUN_AS_NODE=1 "$ELECTRON" build/tests/refresh-rc44.cjs        # refreshed，market 0.1.0-pilot.16.4
ELECTRON_RUN_AS_NODE=1 "$ELECTRON" market-tests/test-market-errors.mjs # PASS 7
ELECTRON_RUN_AS_NODE=1 "$ELECTRON" market-tests/test-authority-scenarios.mjs # 不可达/超时/HTTP 503/伪造签名/实时校验
```

普通 node 下缺少网络守卫与 asar 解析，验收会失败，不能据此判断回归。

- 在原报错 mini 上：Electron 直连局域网仍为 `EHOSTUNREACH`，`CatalogAuthority` 经回退刷新为 fresh、revision 5。

## 未完成

两台试用 Mac 安装 rc44.2 后的图形界面复核、新机原生 GUI 首次启动、互联网下载后的系统信任、真实模型与教师效果。包仅 ad-hoc 签名，未经 Apple 公证。发布为 prerelease，不标记 latest。
