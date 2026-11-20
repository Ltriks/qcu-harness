# rc.4.5.5 双端交付验收（2026-11-19）

交付版本 `0.1.0-rc.4.5.5`，构建 `rc45.6`，数据套件版本仍为 `0.1.0-rc.4.5`。源码工作树为 `.work/release-rc45` / `fix/qcu-windows-rc451`；本轮未推送、新建标签或GitHub Release。旧版ZIP保持原样。

## 修复和组成

- `qcu-branding 0.3.0-pilot.7`：正确解包官方RPC与Host双层返回；状态读取超时匹配后台预算；Windows ACL检查由Worker执行，不阻塞Host主线程。
- 首次进入首页，说明实际渲染并可见后才默认开启基础故障上报，可直接关闭。旧schema2显式开/关保留原字节；新schema3区分default/user来源。接收方变更、损坏、写入失败不静默强开，原子初始化不能覆盖并发关闭。
- Mac与Windows的support API、上报设置模块、Host/Client契约、Worker及打包脚本同步更新。
- 冻结组件版本门禁、启动器、升级钩子和release-info统一为当前版本。已知4.5.1—4.5.4 seed可升级，未知构建安全拒绝；失败回滚保留旧配置。
- 构建脚本：`scripts/build-rc455.py`。以摘要固定的正式4.5.1双端ZIP为基线，不重新修改内核ASAR，发布前调用实际套件identity验证组件门禁。

## 已通过验证

| 项目 | Mac Apple Silicon | Windows x64 |
| --- | --- | --- |
| 最终ZIP解压、首次及重复原生准备 | 通过 | 通过 |
| 4.5.1、4.5.2、4.5.3、4.5.4升级 | 全部通过 | 全部通过 |
| 模型配置文件、额外插件、工作文件保留 | 隔离样本字节/内容验证通过 | 隔离样本字节/内容验证通过 |
| 注入更新失败回滚；未知seed拒绝 | 通过 | 通过 |
| 实际Electron：首页告知、默认开启、按钮关闭 | 通过 | 通过 |
| 实际Electron：诊断页显示、退出重开保留关闭 | 通过 | 通过 |
| IP HTTPS测试故障与幂等回执 | 通过，self-test 1条 | 通过，self-test 1条 |
| 签名与文件完整性 | 最终解压后deep/strict验签通过 | 10,178成员逐项摘要通过，供应商EXE签名Valid |
| 原有内核升级保护 | 最终ASAR摘要及后端保护复验通过 | 最终ASAR摘要及后端保护复验通过 |

41项Node回归与9项诊断服务测试通过。所有桌面验收使用隔离Home，没有读取或改写真实用户模型密钥、对话和工作文件，也没有模型调用。页面验证使用实际Electron的本机回环CDP，不把轻量hook测试当作真实界面验收。

Windows测试环境为Windows11 ARM Parallels，执行随包x64解释器与EXE；尚未在独立Intel/AMD实体Windows机器重测。Mac外层为ad-hoc签名，未经Apple公证；首次安装可能需系统明确允许。Windows套件启动器未商业签名。教师业务效果与真实模型效果不属于此次诊断热修验收。

首次Windows空账号会显示官方欢迎窗口，测试经“添加 API Key → 稍后配置”进入首页，未填写凭据。欢迎窗口未关闭时首页隐藏，默认上报保持未设置，符合先展示再开启的规则。测试中未修改或伪造document.visibilityState。虚拟机长EncodedCommand曾未实际启动进程，拆成短命令后完成原生验收；此为当前测试工具链现象，不计作产品失败。

## 云端

`https://111.229.103.201` 已部署严格构建白名单扩展，接受rc45.1—rc45.6，仍拒绝任意新构建。原文件备份 `/opt/qcu-diagnostics/server.py.before-rc455-20261119`；只更换服务代码并重启专用服务，未修改数据库或维护认证。

公网TLS校验与健康200、维护页匿名401通过。双方各上传一条标记self-test的固定字段事件并取得幂等回执；无密钥、配置正文、对话或教学资料。仅新安装在首页告知后默认开，旧版明确关闭不变；首次告知本身不扫描或上传历史记录，沿用启动/故障路径的有限重试。

## 交付

主项目交付目录：`/Users/mcq/Repos/cowork/qcu-harness/releases/0.1.0-rc.4.5.5/`。每个平台含ZIP、安装说明、SHA256与`final-validation.json`，根目录含README与双端校验清单。

| 平台 | 字节 | SHA256 |
| --- | ---: | --- |
| Windows x64 | 403845138 | `667b3131c5a1f82836fe209bea9c2f31ff35a7e481ddd5a064f039bf953a6cad` |
| Mac arm64 | 398171960 | `d583d40d87dd835bec1a94291f77fed4001c67ae092dc5e0bcda1c1a68bd8ed9` |

安装前退出旧版及托盘实例。Windows完整解压到本地短路径如C:\QCU455再运行；Mac完整解压打开app。没有自动替换用户现有应用或重置数据。原始隔离日志和截图在本机私有`.local/diag-20261119/rc455-final-evidence/`，不入Git。
