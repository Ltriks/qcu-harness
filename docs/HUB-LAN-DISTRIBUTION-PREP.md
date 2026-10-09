# 城院 Hub：局域网目录分发与 Mac mini 迁移准备

当前已完成源码准备及本机合成验证，未部署到 Mac mini。DSH 源码零修改，packageReady=false。第二台 test.1 的用户人工安装/启用/停用/移除及重启验收已经独立记录；它不证明真实 Hub 在线。

## 查明的实际位置和差距

本项目中的 Hub 是 hub/web、hub/data/catalog.json、hub/nginx 及 hub/scripts 的静态目录站源码。2026-10-09 本轮只读检查：本机 127.0.0.1:19390/catalog.json 返回 HTTP 200，插件只有旧 qcu-table-audit 0.2.0-prototype.5 合成 fixture；127.0.0.1:8080 拒绝连接。源码目录包含10个 Skill、4个插件，全部 draft，未带本阶段所需固定受审文件、SHA256及 rc.2 精确兼容声明。没有发现正式网站域名、已部署主机路径或 Mac mini 连接配置；不能将 fixture 认作正式城院 Hub。

用户已选择先局域网使用，拟主机192.168.1.68（Sentinel_e35f583492f88191a1ac6d3bbc2a9311）。本轮环境仍只有原开发 Mac，未探测、SSH、安装或改动 mini。现有部署脚本会尝试启动 Colima、切换 Docker context、重建容器并按旧 PID 停服务；未执行。旧 nginx:alpine 未固定镜像摘要，原 compose 端口绑定没有明确限定局域网接口，这些历史配置不等于已验收的迁移方案。

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

mini部署仍需：将该机作为明确授权执行环境连接（无需发送密码或私钥）；只读确认当前局域网IP/8080占用/现有网站与服务/运行时能力/磁盘；如已有网站，先列出要保留的数据并取得备份证据。然后确认限定部署目录、首个分发包及访问人群、只读服务进程管理和停止/恢复方式。未连接前不能承诺端口空闲、备份完成、服务自动清理或LAN可达。公网、校外访问、正式签名发布和Windows均不在本轮范围。
