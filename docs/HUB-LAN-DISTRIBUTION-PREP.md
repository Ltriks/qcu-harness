# 城院 Hub：局域网目录分发与 Mac mini 迁移准备

当前已完成源码准备、合成验证、mini严格SSH预检、独立暂存分发及获准后的只读LAN试用站启动。20项真实LAN HTTP验收通过，GUI未验；站点保持可访问。DSH 源码零修改，packageReady=false。第二台 test.1 的用户人工安装/启用/停用/移除及重启验收已经独立记录；它不证明真实 Hub 在线。

## 查明的实际位置和差距

本项目中的 Hub 是 hub/web、hub/data/catalog.json、hub/nginx 及 hub/scripts 的静态目录站源码。2026-10-09 本轮只读检查：本机 127.0.0.1:19390/catalog.json 返回 HTTP 200，插件只有旧 qcu-table-audit 0.2.0-prototype.5 合成 fixture；127.0.0.1:8080 拒绝连接。源码目录包含10个 Skill、4个插件，全部 draft，未带本阶段所需固定受审文件、SHA256及 rc.2 精确兼容声明。后续在历史Agent-Learning-Hub/infra/skill-catalog-mvp资料确认旧站地址192.168.1.17:8080和同步目标~/skill-catalog-mvp；它保存10个published Skill ZIP及1个安装器TGZ。QCU导入副本刻意去掉包并改为draft，不能把副本状态概括成旧网站不存在；19390仍只是fixture。

用户已选择先局域网使用，拟主机192.168.1.68（Sentinel_e35f583492f88191a1ac6d3bbc2a9311）。用户随后授权既有SSH分发检测（Sentinel_8dd40b7a7d4c81919739d1248a6ba8f6），现已严格核验主机并完成个人mini只读预检；未安装或更改安全设置。现有部署脚本会尝试启动 Colima、切换 Docker context、重建容器并按旧 PID 停服务；未执行。旧 nginx:alpine 未固定镜像摘要，原 compose 端口绑定没有明确限定局域网接口，这些历史配置不等于已验收的迁移方案。

静态网站可迁到 mini；迁移对象只应是审阅后的网页、目录和对应包，不是用户 DSH Home、模型设置、聊天数据或 API Key。网页只分发，DSH及审批仍在使用者自己的官方 App 内。

## 已实现的源码入口

- hub/release/catalog.mjs：schemaVersion=1 严格验证、只接收受审 private LAN published 条目、精确版本和明确 dshVersions；插件默认关闭。文件名包含 id、精确版本和完整SHA256，不能将同一版本换成另一内容。目录上限256 KiB、单包32 MiB、整批64 MiB。
- verifyDirectory/stageRelease：检查大小、哈希、链接及精确文件；只创建新目录，不覆盖既有输出。包含网页、目录及经过校验的包，不复制其他文件，不部署、不切换 current、不调用 npm pack 或安装脚本。
- fetchPinned：用户明确选择受信 origin；目录 SHA256 必须来自独立受信渠道。HTTP只支持数字回环/RFC1918地址，或使用HTTPS；禁止URL凭据/查询/片段、重定向，流式限制下载，哈希正确才新建只读目标文件。不会安装或解压。目录站自己提供的哈希不能证明来源；局域网HTTP也不提供身份认证或加密。
- planChange：生成固定 from/to 与已保留旧版本的回退计划，拒绝同版内容改写；不执行升级，不承诺 profile数据回退兼容。官方逐次审批、精确row、正常重启及兼容门槛始终保留。
- hub/release/serve.mjs：显式只读路径白名单，默认127.0.0.1；绑定数值私网地址必须另给 --lan-approved。拒绝全接口、外国Host、写请求、查询和未知路径，不列目录、不记请求日志。该服务没有登录认证，只适合不含机密的受审包；不建立launchd、改防火墙/DNS/路由或操作Docker。
- hub/web/index.html：新目录显示固定哈希、精确DSH版本与合成标签，不生成旧安装器命令；条目标签通过textContent构造，避免目录文本进入innerHTML。尚未进行本轮浏览器像素验收。

示例 hub/release/catalog.example.json 指向已获试验批准的合成探针，published 只指此私有合成分发候选，不表示生产插件审查或公开上架。实际 hub/data/catalog.json 与运行中的旧fixture保持原样。兼容字段是发布者的精确声明，不能取代官方peer兼容检查或目标平台验收。

## 可审阅的离线操作

先在新候选目录提供 catalog.json，以及其 plugins/skills 中对应的不可变包。示例中的探针包可来自已交付 test.1，按目录文件名复制；SHA256必须匹配，不重新打包。以下只准备产物：

```sh
node hub/release/catalog.mjs verify "$CANDIDATE"
node hub/release/catalog.mjs stage "$CANDIDATE" "$NEW_RELEASE"
```

verify/stage 输出 catalogSha256。通过已经信任的单独渠道把这个固定目录哈希提供给使用者；不能只把网页和网页自己的哈希当成信任依据。当前不是签名目录体系，没有伪造签名或隐含证书。

部署得到明确授权且 mini 条件核实后，才考虑在 mini 手动运行以下只读服务（目前没有执行）：

```sh
node hub/release/serve.mjs "$NEW_RELEASE" 192.168.1.68 8080 --lan-approved
```

监听失败即停，不换端口、结束冲突进程或自动放宽系统设置。不自动开机启动。原始源目录文件使用当前用户权限，若以后改用容器/另一账号运行，应先明确只读访问权限及进程管理方式，不能直接照搬历史Docker脚本。

客户端下载操作必须自己选择这次目标及独立受信的目录哈希：

```sh
node hub/release/catalog.mjs fetch "$TRUSTED_ORIGIN" "$TRUSTED_CATALOG_SHA256" plugins "$ID" "$EXACT_VERSION" 0.2.0-rc.2 "$NEW_TGZ" --trusted-origin
```

下载成功的 installed=false。后续实际安装使用官方 plugin_manager、本机精确target及用户逐次批准，遵循已通过 test.1 的拒绝/允许和正常重启流程。不能把目录首页当 install_bundle package spec。

## 更新和回退边界

先保留并独立校验旧目录和旧包，再在新目录准备新版本；同一版本/哈希的文件不可覆盖。对明确的旧/新版本调用 planChange 后，只获得计划，不自动执行。实际更新前确认没有活跃未保存任务、官方兼容允许、新包确实受审；先停用Bundle并正常Quit/restart，再按官方返回安排单次批准安装和精确row启用，重启后做业务验收。失败时保持新版本停用，按官方生命周期使用原已核验包进行显式回退，不绕过stop-profile/版本门槛。profile状态或数据格式回退须另测；保存旧TGZ本身不是可恢复数据的证明。

首个非合成包尚未选择和审定。默认不采用latest、版本范围、社区全家桶、安装脚本授权或永久Full Access。未来若需要自动更新或签名目录，应先明确发布者身份、密钥管理及升级许可，不能用同站checksum替代信任来源。

## 本轮验证和迁移最小前置条件

11项新增Node测试通过：draft/未审/版本范围/路径拒绝、确定性校验及新目录不覆盖、链接拒绝、受信固定下载、目录与包篡改及兼容失败不写入、HTTP origin及重定向拒绝、超量流中止、固定更新/回退与同版改写拒绝、真实临时回环HTTP传输、服务只读白名单/Host/HEAD、整批大小限制。测试包为不安装的合成字节；另用已交付真实test.1 TGZ验证离线stage，1279字节及固定包哈希一致，目录哈希记录在 evidence/hub-lan-preparation.json。所有测试监听都只在本机随机回环端口，并已关闭。

mini预检、新目录暂存分发及具体LAN启动授权均已完成，实际可达性和固定字节检查通过，见最新验收。没有覆盖旧目录，也不宣称未知旧站数据已备份。公网、校外访问、正式签名发布和Windows不在本轮范围。

## mini既有SSH预检及暂存分发（2026-10-09）

canonical qcu-harness/hub 为唯一源码基准，main为756b7331b2eaf91aff5340c62cedaf5261af7876，开发分支包含此导入提交，28个原Hub文件全部保留。历史infra只作部署和资源参考；旧安装器同为0.1.0但8个文件中5个与canonical不同，不能直接当新版分发。10份Skill正文匹配，course-qa还有3个未收录资源，本次不转移这些材料。

mini严格known_hosts校验通过，个人机身份与既有记录一致：arm64、macOS26.7.1、Wi-Fi192.168.1.68、有线DHCP192.168.1.30。可用磁盘约872GiB，Home所有者已确认。8080/8081未发现监听，四个明确Hub候选目录及相关launchctl标签未发现；没有全盘扫描。已查路径未发现Node/Docker/Colima，系统Python3.9.6可用。没有新增密钥、放宽主机校验或读取私密数据。

新增release/serve-hub.py仅用已有Python标准库。准备阶段仍由同一源码的Node校验器检查完整schema；Python校验独立受信manifest及文件字节，并提供只读snapshot服务。默认只验证，只有--serve才监听；私网监听另需--lan-approved，全接口和公网地址拒绝。不列目录、不记请求，不公开助手、manifest或README。6项Python检查通过，含真实临时回环HTTP路由、Host、写请求及路径/链接/篡改拒绝；测试服务已关闭。

已获准暂存分发7文件、39621字节：canonical index.html/themes.html、schemaVersion1合成catalog、固定test.1 TGZ、Python助手、README和manifest。远端目录由mktemp新建、本人拥有、0700，没有采用旧目录。远端验证所有文件通过，serviceStarted=false，8080/8081仍无监听。manifest SHA256：0e5b2eed25f902fff08a77d43b0c143f6fed610d76515ab1c9dc17a837791492。精确路径只写本地收据，不入Git；未带旧安装器、课程材料、DSH Home或凭据。完整旧站尚未恢复上线。

上述启动范围已获用户明确批准（Sentinel_dd623789b488819198004433af620e0c）；启动前再验端口、所有者和manifest。为保持用户试用入口，采用本次PID管理的独立用户进程，SSH结束后仍运行；没有launchd或开机自启，不改防火墙、不停止其他服务。首次目录只有合成探针；正式Skill/插件分发仍需明确审阅版本、来源及升级许可。

## 当前可访问站点与生命周期

试用页面：http://192.168.1.68:8080/themes.html；目录首页：http://192.168.1.68:8080/。从MacBook实际LAN HTTP验证20项通过：canonical首页/themes逐字节一致、目录和固定包SHA256一致、HEAD、POST/PUT/DELETE拒绝、原始及编码穿越路径拒绝、未知查询/目录拒绝、外国Host拒绝、manifest/README/助手/日志/PID管理文件拒绝；写请求后目录哈希未变。没有浏览器控制工具，未把HTTP结果记为GUI像素或交互验收。没有调用DSH安装或升级。

保留用户获准试用服务；不在验收末尾自动停止或删除暂存。停止操作必须从拥有的启动记录读取当前PID，并核对进程UID、启动时间及完整参数，匹配后仅发送该进程SIGTERM；已通过只读控制检查，实际停止未执行，以保持用户可查看。不能使用历史文档PID或全局kill。精确路径、PID和操作助手只存本地分发收据；公开Git证据中的PID仅为当时观察值，不能直接拿来停止。用户需要停止时由执行代理再次检查后处理。该进程不依赖SSH会话，但mini重启或进程退出后不会自动恢复，需要显式重启操作；没改电源、网络或系统启动设置。

此页仍是canonical网页搭配私有合成目录，完整历史Skill目录恢复、实际插件升级/回退、正式分发与GUI验收未通过。详见[evidence/hub-mini-lan-acceptance.json](evidence/hub-mini-lan-acceptance.json)。
