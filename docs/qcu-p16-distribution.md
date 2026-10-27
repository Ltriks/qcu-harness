# P16 固定清单下载适配

此适配只为现有 `hub/release/serve-hub.py` 增加可选的静态下载文件。原快照单文件 32 MiB、总计 64 MiB 限制与包校验不变；不新增端口、进程、依赖、上传或文件管理接口。

在原启动参数上同时添加以下两项；省略两项时行为不变，单独提供一项会失败：

```sh
python3 hub/release/serve-hub.py \
  --root /absolute/public-snapshot --manifest-sha256 <snapshot-sha256> \
  --distribution-root /absolute/distribution \
  --distribution-manifest-sha256 <externally-reviewed-manifest-sha256>
```

默认只验证并退出。实际启动仍使用原来的 `--serve`、8080 端口及既有私有 LAN 绑定参数。适配实现阶段没有执行部署或服务切换；后续已授权上线状态见 [P16部署记录](qcu-p16-deployment.md)。

分发根目录示例：

```text
distribution/
  manifest.json
  downloads/
    reviewed-client.zip
    branding.tgz
    guide.html
```

`manifest.json` 的原始字节 SHA-256 必须通过独立可信渠道固定到 CLI 参数。JSON 只允许以下精确结构，任何层级的重复字段、额外字段及非标准数字均拒绝：

```json
{"schemaVersion":1,"files":{"downloads/reviewed-client.zip":{"bytes":390492068,"sha256":"<64 hex digits of the exact reviewed file>"}}}
```

上例是结构说明；哈希占位符不能用于启动。父任务负责为已审阅、字节不变的 ZIP、品牌 TGZ 和静态使用说明/验收资源制作清单；本适配不签名、不解包、不重新构建这些文件，也不改变出版或更新策略。

最多 8 个文件、合计 1 GiB；ZIP 每个最多 512 MiB，TGZ 32 MiB，HTML/MD/TXT 各 1 MiB。允许空文件。文件名以 ASCII 字母或数字开头，主体只含 ASCII 字母、数字、点、下划线和连字符，主体最长 120 字符，扩展名必须是小写 `zip/tgz/html/md/txt`。只开放清单中的精确 `/downloads/文件名`；查询串、编码路径、嵌套目录、遍历路径、清单本身和未列入清单的文件均不可下载。

根目录必须是绝对路径且不含 `..`。根目录、全部祖先和下载目录不得经过符号链接；文件必须是普通文件且硬链接数为 1。目录和文件须由当前用户或 root 所有，不允许组/其他用户写入或 setuid/setgid，文件不得可执行。仅根目录之外、root 所有的 sticky 临时祖先目录可例外拥有写权限，便于安全临时夹具。建议目录 0755 或 0700，文件 0644 或 0600；macOS 的 `/var`、`/tmp` 别名须改用实际 `/private/...` 路径。

启动时以最多 64 KiB 块核验大小和 SHA-256，不将 ZIP 放入快照内存。每次 GET/HEAD 通过逐级 `O_NOFOLLOW` 打开并 `fstat`，核对 dev/inode/size/mtime_ns/ctime_ns；缺失、被替换、权限不安全或内容已变化时返回通用 404，不透露路径。运行期间应保持已校验文件只读、静止；更新需要重新校验并重启服务，禁止原地写入。此设计不是持续写入情况下的文件系统事务快照。

GET/HEAD 返回 Content-Length、固定 Content-Type、nosniff、SHA-256 ETag 和 `Accept-Ranges: bytes`。支持单段 `bytes=start-end`、`start-`、`-suffix`，合法范围返回 206；格式错误、多段、重复 Range 头或不可满足范围返回 416。If-Range 与 ETag 不一致则返回完整文件。静态 HTML 使用 sandbox CSP，允许内联样式，禁用脚本、外部资源和表单。沿用现有 5 秒套接字读写超时及 Host 校验，不改变 TLS、操作系统或浏览器安全设置。

限定验证命令（全部使用临时合成夹具，不访问真实安装包、凭据或教师 Home）：

```sh
rtk proxy python3 -B -m unittest discover -s tests -p test_hub_distribution.py -v
rtk proxy python3 -B -m unittest discover -s tests -p test_hub_python_server.py -v
rtk proxy python3 -B -m unittest discover -s tests -p test_product_polish_feedback.py -v
```
