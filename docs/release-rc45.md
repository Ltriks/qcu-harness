# rc.4.5 构建、归档与验证

本轮发布分支 `release/qcu-teacher-rc45`，统一标签 `qcu-teacher-v0.1.0-rc.4.5`。基于已推送的 Mac rc44.2 归档提交6870447整合本线程的新组件，不合并或推送main，不从 .19 的用户数据目录取构建输入。

## 输入与源码

- Mac基础ZIP：`QCU-Teacher-0.1.0-rc.4.4.2-mac-arm64.zip`，SHA256 `7fb571edbb1067553160e1e649741f61ea6a2f45156fd67ba890ae4e81cf966b`。
- Windows基础ZIP：`QCU-Teacher-0.1.0-rc.4.4-win-x64-rc44.2.zip`，SHA256 `6303006068d3e3803b302df4acf5afa107736535850d9f63293d98b7918c1dee`。
- 固定官方内核DSH0.2.0-rc.2。两个平台继承各自既有运行时、许可证和平台适配，不混用Mac与Windows的ASAR摘要。
- 新组件：市场16.14、专家团0.3.0-pilot.8、主题0.3.0-pilot.6；Hallmark、会计系包及五个社区团队0.1.0-pilot.1。原七教学技能、飞书只读保留，课程工作台不预装。
- 市场Client维护源明确为 `sources/qcu-market/client-shell.js` 和 `src/capability-library.mjs`，通过 `scripts/build-market-library.py` 重建；旧版模块构建退役，历史源码保留在rc44.2标签。专家团、主题仍从各自src/build.mjs生成。
- 启动器和支持模块在 `release/rc45/{mac-arm64,win-x64}`；云端服务在 `services/qcu-diagnostics`。密码、SSH私钥、现场数据库、原始回执和工作夹具不入Git。

## 构建步骤

运行 `python3 scripts/build-release-rc45.py stage --target <mac-arm64或win-x64> --base <对应固定ZIP> --stage <全新目录>`。脚本验证基础ZIP摘要，使用无账号seed重新编排18项固定组件与归档，生成版本和完整seed清单；Mac编译arm64原生启动器并进行临时签名。Windows启动器须在Windows上用Launcher.cs编译为x64 GUI子系统EXE，完整源码和本次VM驱动在release/rc45/win-x64。

`python3 scripts/build-release-rc45.py pack --target <平台> --stage <目录> --out releases/0.1.0-rc.4.5/<平台>`：拒绝覆盖既有ZIP，校验seed后构建完整ZIP并检查CRC；写出delivery.json和SHA256SUMS。构建不读取日常用户profile，不预填模型Key，不发送模型请求。

## 验证结果

- 37项JS/官方Cordis接线与状态测试、7项Python投稿契约测试通过。首页/窄屏实际React浏览器检查通过，空输入首页办公入口直开任务草稿。
- 云端接收服务8项协议/存储检查通过。Mac与Windows来源绑定的上报同意测试通过：切换接收方不沿用旧同意。
- Mac支持逻辑9项检查通过：冻结组件与seed摘要、首次和重复准备、配置保留、已占目录保护、异构组件拒绝、诊断默认关闭、不预装课程；使用现有已信任rc44原生提交辅助器和独立临时Home，不把这当新启动器验收。
- 官方捆绑AgentLoop/工具/Session的脚本模型测试通过，使用合成适配器，云模型调用0。冷加载全部产品、发现18项Skill；未验证真实模型和教学效果。
- Windows11 ARM虚拟机实际x64启动器编译和首次/重复准备、8项故障保护/脱敏诊断与权限检查通过。供应商EXE签名Valid。原生x64硬件与GUI仍待验收；最终ZIP的Windows系统解压与再次准备未取得完成回执，保持待验收，不能用本机ZIP CRC替代该项。
- Mac新APP临时签名静态校验通过，但原生打开被系统Gatekeeper信任拦截，未关闭或绕过系统保护。最终新包GUI/正常退出重开须用户允许后验收；未苹果开发者签名、公证。
- 两端ZIP CRC及seed一致性已核对；精确大小和SHA256见各平台delivery.json。

## 腾讯云诊断

用户指定root@111.229.103.201并配置专用SSH公钥，明确要求固定IP、不使用域名。客户端固定 `https://111.229.103.201`；正规IP证书已签发，SAN包含该IP，证书检查不关闭。续期timer每天四次检查，续期及部署钩子的模拟检查通过。修复Windows权限检查消耗网络超时预算的问题，Mac和Windows均已通过实际客户端合成诊断及幂等回执。公网健康接口、匿名查询拒绝401、登录后HTML/API200、新版实际客户端合成诊断及幂等回执通过；5条旧记录只读复制并保留编号/时间，原 .68 服务和数据不变。

维护账号仅保存在部署操作者的私有文件，服务器保存密码散列。默认关闭自动上报；断网保留本地，有限重试。上报服务不读教学资料、模型密钥或对话。工具市场和课程相关服务未随本轮迁移到云端。
