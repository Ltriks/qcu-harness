# QCU目录一期（pilot.5）

2026-10-11。仅隔离源码及测试交付，不替换Mini已验收的市场P4.2/教练P2，不发布Hub，不启动第二DSH实例。

## 已实现

- 一个审核输入 `hub/plugins/qcu-market/catalog-input.mjs` 引用既有教练发行记录；构建生成一份冻结目录供Host/Client共享。schema v2、协议2、目录revision 1；SHA256是随市场包固定的内容承诺，不是远程发布者认证。
- 仅教练P2一条真实可安装记录。多条目结构、逐条flow及跨卡片串行控制已实现；第二条仅在合成测试中出现，不进入交付目录。
- 严格字段、条目数量/字节上限、精确rc.2适用版本、固定来源、包/skill身份、不可变文件名、size/hash、重复标识和版本校验。draft/withdrawn/官方能力不进入本期可执行schema；不伪造安装按钮。
- `prepare(UUID, releaseKey)`只允许Host在随包审核目录中查找条目，不接受URL/path/hash。收据绑定UUID、releaseKey、catalog SHA及五分钟有效期；确认前重新检查Host协议/指纹、收据、实例状态及官方inspect。重复收据ID拒绝，连接变化作废确认并撤销收据。
- 卡片从目录呈现用途、场景、来源、适用版本、前提、风险、测试状态、示例；真实安装/启用状态仍来自官方manager。安装默认禁用，包与组件启用分别确认。未知安装结果阻止重复操作，返回/卸载保留原有取消与生命周期处理。

## 验证

最终归档 `qcu-market-0.1.0-pilot.5.tgz`：

`SHA256 2f42c3f9f1a95d2857dbe0a22fb0d540dfd729ba4480ac4358b220be86b4317f`

- 源码及归档HTTP总套件：104/104通过。包括schema异常、伪造源/脚本/远端自报hash、同版异hash、超限、多合成条目状态隔离、并发确认锁、取消/重入/错误、过期及确认绑定。
- 实际归档官方Cordis/Slots/Client/Host范围回归：15/15通过。
- HTTP套件使用归档Client → 官方ClientConnection → localhost随机端口 → Gateway → 归档Host；14项通过，包含拒绝未审核releaseKey/额外URL字段。管理业务后端仍为fixture，不执行pnpm、不写真实profile。依赖运行代码与官方ASAR核对12个文件，app-boot使用归档提取的精确字节。
- Node构建/语法检查通过。首次在受限沙箱运行HTTP测试因loopback监听被阻止；使用已授权的本地隔离测试权限后通过，不扩大App网络权限。
- 真实DSH安装、全新Home首次下载/取消/安装及新界面视觉验收：**not tested**。不得把上述模拟/HTTP测试当作真机验收。

复现：先运行 `node hub/plugins/qcu-market/build.mjs`，按 `scripts/prepare-market-loop-tests.py` 和 `scripts/prepare-market-http-tests.py` 准备已有官方依赖及不可变包，设 `QCU_OFFICIAL_DEPENDENCIES` 后运行 `node --experimental-transform-types --expose-internals --test tests/qcu-market*.test.mjs`。不下载依赖，不安装到真实profile。源码设计及未来契约见 [目录设计](qcu-market-catalog-design.md)。

## 现场隔离阻塞与后续范围

官方打包App启动会设置账号默认日志路径并注册全局 `dsh` 协议，登录shell/账号缓存也不由DSH_HOME隔离。没有找到覆盖全部共享路径的受支持开关，因此本轮不创建新Home、不启动或停止App。端口0有源码支持，但不是完整隔离证明，详见 [启动审查](qcu-market-fresh-home-startup-review.md)。

2026-10-10 16:52:55 UTC只读复核：默认市场P4.2/教练P2，主进程24522、Host24530、19387监听者均未变；package.json、pnpm-lock.yaml、cordis.patch.yml的SHA与16:39:56 UTC前检一致。

下一步现场动作须先有可证明隔离的官方环境或另行批准的测试设备/账号方案，再确认具体Home、workspace、网络、日志/缓存及协议注册影响。市场pilot.5包安装/启用及教练首次安装的风险确认由用户亲点；不复制默认模型配置，不自动授权脚本、扩大权限或重启。当前授权不包含改默认成功环境来换取测试结果。

远程可变目录、在线更新、撤回处理、签名密钥均未实现。未来只考虑固定Hub origin + 随包catalog SHA/revision/size上限的契约；远端自报hash永不赋予信任。当前没有远程目录入口，也没有后台联网或自动安装。
