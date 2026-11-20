# QCU 云端诊断接收与查询

生产地址：`https://111.229.103.201`。查询页：`/maintainer`，使用独立维护登录。无域名；证书包含该公网IP的SAN，验证TLS，不跳过证书检查。

## 部署组成

- `qcu-diagnostics.service`：非登录用户 qcu-diagnostics，Python 标准库服务，仅绑定 127.0.0.1:18768。
- `qcu-diagnostics-proxy.service`：独立 Nginx 配置 `/etc/qcu-diagnostics/nginx.conf`；保留服务器原有宝塔和博客配置。宝塔版 Nginx 需要本目录中的 Lua 库路径。
- 诊断公共路由为 `/health`、`POST /v1/incidents`、按随机故障编号查询回执；无公开故障列表。请求大小16KB，拒绝多余字段、跨站Origin及不合法构建；限流和并发上限保留。
- `/maintainer`、`/maintainer/*` 和 `/v1/maintainer/*` 都由 HTTPS Basic Auth 保护。密码散列仅位于服务器 `/etc/qcu-diagnostics/maintainer.htpasswd`，不入Git。
- SQLite：`/var/lib/qcu-diagnostics/data/incidents.sqlite3`，目录0700、文件0600。无通用文件下载或批量导出API。

## 证书与维护

Certbot 5.4.0 和依赖固定在 `certbot-requirements.txt`，虚拟环境 `/opt/qcu-certbot`；IP证书使用 shortlived 配置，约六天有效。`qcu-diagnostics-cert-renew.timer` 每天检查四次并随机延迟，续期后reload专用Nginx。不要关闭80端口的ACME挑战路径；443用于客户端和查询页。

查看服务：`systemctl status qcu-diagnostics qcu-diagnostics-proxy qcu-diagnostics-cert-renew.timer`。查看续期：`journalctl -u qcu-diagnostics-cert-renew.service`。验证：`/opt/qcu-certbot/bin/certbot renew --dry-run --run-deploy-hooks --no-random-sleep-on-renew --cert-name 111.229.103.201`。

初始部署执行 `deploy.sh`，它只创建专用用户、目录和两个服务，不覆盖已有专用Nginx配置。先以 `nginx-http.conf` 提供ACME路径，申请正式IP证书后安装 `nginx-https.conf` 和维护密码散列，再启用续期timer。云端系统是OpenCloudOS 9.6；安装Python pip时仅本次命令关闭不可达的docker-ce-stable仓库，不改Docker配置。

## 数据与验收

2026-11-17 从 .68 只读导出5条历史记录，通过 `import-history.py` 校验编号、指纹和摘要后幂等导入，保留收到时间；旧服务和数据仍在。另发一条自测故障验证新版真实客户端请求及回执，未发送模型请求或教学资料。

默认关闭自动上报。客户端 `reporting-endpoint.json` 是构建配置；同意记录绑定接收方ID及地址摘要，地址变化后不沿用旧同意。断网保存在本机，有限重试，不阻塞打开。Windows rc.4.5.1 起另提供只读签名市场目录 `/market/catalog.signed.json`、历史组件更新 `/updates.json` 和固定 `/plugins/*.tgz` 归档；无公开上传或发布管理接口，私钥仍留在受控发布机。课程服务及原有市场反馈按各自部署维护。

Windows权限检查耗时不计入网络预算，保留原有ACL校验和网络上限；此修复已在Windows11虚拟机完成真实HTTPS回执检查。

## 2026-11-19 rc45.6 接收兼容

服务端严格白名单已包含 rc45.1 至 rc45.6，覆盖 rc.4.5.1—rc.4.5.5 套件；不接受任意 rc45.*。更新前原文件备份为 `/opt/qcu-diagnostics/server.py.before-rc455-20261119`，数据库未迁移。9项本地服务测试通过，双端 rc45.6 固定字段 self-test 已通过公网IP HTTPS并收到幂等回执。健康接口200，维护页匿名401；无凭据或教学内容随测试上报。

## 2026-11-20 QCU Buddy rc45.7 接收兼容

严格白名单扩展到 rc45.7（包4.5.6），仍拒绝任意构建。备份 `/opt/qcu-diagnostics/server.py.before-rc456-20261120`；数据库与维护认证保持。9项测试及最终Mac/Windows公网HTTPS自测和幂等回执通过；健康200，匿名维护页401。参见 `../../docs/release-rc456-validation.md`。
