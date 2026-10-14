# QCU 市场 P9.1 Hub 发布记录

2026-10-14，用户明确要求将 P9 安装包发布到现有 Hub，由用户及 mini 上 Cursor 协助进行 DSH 验收。已发布审核后的固定 P9 市场包；本轮没有操作 DSH、模型、Home 或凭据。原生验收按[Cursor 任务书](qcu-market-p9-cursor-acceptance.md)或[用户验收表](qcu-market-p9-user-acceptance.md)执行。

## 安装包

| 项目 | 固定内容 |
| --- | --- |
| 名称/版本 | `qcu-market` / `0.1.0-pilot.9.1` |
| 下载 | [P9 固定 TGZ](http://192.168.1.68:8080/plugins/qcu-market-0.1.0-pilot.9.1-ecdc4373baad4de8415c27a6b04aa31b9e01ae516a6e3e972660a32bd7108e12.tgz) |
| 字节数 | 43446 |
| SHA256 | `ecdc4373baad4de8415c27a6b04aa31b9e01ae516a6e3e972660a32bd7108e12` |
| 对应源码 | `dev/qcu-market-p9` / `bb1e5c80a01f26f1ab147717cbd9f79b57b198e3` |
| 精确支持基线 | 官方 DSH `0.2.0-rc.2`，Apple Silicon Mac |

在官方“插件 → 添加插件 → 包名或地址”填入完整 TGZ URL，核对后确认安装；启用依官方 UI 另行处理，提示重启时正常退出再打开同一实例。普通教师使用自己的正常 DSH，不需要测试启动器。mini 专项验收沿用已有测试 Home，按任务书正常切换与恢复，不能重建 Home 或复制凭据。

市场新增五步新手指引、备课/分层练习/教研简报三个任务模板、本地问题反馈；生成文本与复制不自动调用模型或提交。三个模板仍使用原固定教学 Skill 包，八个市场产品的归档均已在 Hub，不重复打包或改变其字节。API Key 仍由用户自行在官方设置配置。

## 发布与保留

Hub 继续使用 `http://192.168.1.68:8080`，仅局域网。新目录为 Hub 用户的 `$HOME/qcu-hub-pilot-20261014-p9.1-ecdc4373baad`；原 `$HOME/qcu-hub-pilot-20261013-p8.1-c646b4f3f392` 保留。仅复制原清单允许的资源、增加一个 P9 TGZ、更新 Hub schema1 目录与资源 manifest；不复制或公开运行配置、凭据、源码目录和运行日志。

旧12个TGZ与原目录17个清单文件逐项核对不变；Hub现在保留13个历史/当前TGZ，DSH市场仍是八个当前真实产品。发布没有改写市场固定审核目录、协议或任何历史包。Hub服务代码SHA256仍为 `8153e989daa6422fa5eb99afa02744f248a6c535a1622099287307e698da206e`，绑定、端口、依赖与只读边界不变，未新增自动启动。

切换前核对旧监听PID50273、属主、完整命令、启动时间和清单指纹，只正常结束匹配的Hub进程并确认退出。新Hub现场观测PID58265，启动时间 `Wed Oct 14 14:29:50 2026`；均为历史观测值，后续操作须重查，不能照搬PID。本次准备旧服务恢复分支但未触发，未强退或操作DSH。

| 指纹 | SHA256 |
| --- | --- |
| 新 Hub catalog.json | `e3f720555823f30e790eb26ef108a31f7132d176ab1e888dc23911ca6aa92eff` |
| 新 manifest.json | `a994b574a5104464a74d6f0917ffdfc5449857c7d381928533b07a24d2d811a2` |
| 原 P8 manifest.json | `4dbea2154ed67a6a96dab88c96e62f9082f9c514a5ef73fc53b0451e7750a9aa` |
| 原 P8 catalog.json | `33b48e419a98a3ffb6b17a70129432d20c246dc914e548167ccbb8668708db14` |

## 验证结果

| 检查 | 已通过/失败/未测 |
| --- | --- |
| P9 TGZ大小、SHA256及14个普通成员与已推送源码/当前源码一致 | 通过 |
| 市场八个产品指向原Hub固定包，大小与SHA256对应 | 通过 |
| 新目录离线服务校验 | 通过，17条可服务路由含首页别名 |
| 新Hub启动后的实际资源下载 | 16/16通过 |
| 从开发机独立LAN下载/边界检查 | 25/25通过，0失败：16资源大小/哈希、7边界、固定TGZ HEAD、首页别名 |
| HTTP边界 | manifest、服务源码、runtime、stage及路径穿越404；POST405；外部Host403；包为immutable缓存 |
| 旧包与原发布目录 | 12包保留；原manifest和17个文件发布后再次核验不变 |
| P9先前本地源/HTTP/浏览器与归档回归 | 295项与21项通过；本轮未重复，见[父线程检查](qcu-market-p9-parent-validation.md) |
| 原生DSH安装/启用/重启、模型、Skill调用与教师审核 | 未测，交用户/Cursor执行 |

发布阶段没有未解决失败。历史本地失败与两项全库扫描历史命中继续保留，不因Hub发布变为通过。预览截图仍是共享React合成后台，不能冒充mini实机。

本次证据保存在开发机 `$HOME/Artifacts/qcu-harness/0.1.0-pilot.9.1/deployment/`：新旧manifest/catalog、plan、stage/runtime、hub-lan-verification、DELIVERED及操作辅助脚本。先前根目录的DELIVERED与候选清单仍保留其当时“本地、未部署”状态，本次deployment记录是新的发布证据；不覆写历史。

## 回退与后续

如需回退Hub，先重新核对当前监听属主、完整命令和指纹，离线校验保留的原P8目录及其manifest固定SHA。经用户指示正常结束该Hub，按原root/pin和同一LAN地址启动旧服务，再核对catalog与下载。不删除目录、不强退、不复用历史PID。Hub回退不更改已安装的DSH版本或profile，不是客户端回滚保证。

等待用户/Cursor报告通过、失败与未测，并由教师确认三个实际任务输出。保持mini已有测试Home原位，正常退出测试实例后普通打开官方应用恢复默认环境。不公开发布、不扩大LAN、不合并或推送main。
