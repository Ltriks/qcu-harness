# 测试归档与临时文件服务

这里的 `.fixture` 是ZIP/TGZ二进制测试输入，不是可供用户安装的发布包。`archives.json`保存格式、标识、完整包SHA256和签名清单所需文件记录；测试运行时用公开的DemoFixtures测试key签名，绝不形成生产信任。

`fixed-study-coach.fixture`为已发布`qcu-study-coach@0.1.0-pilot.1` TGZ的原始字节。SHA256固定为`76ed55721d7a78237af6b05bca683a045fb232374c3d869af3676f90368c4f6c`。本次逐一核对8个成员：插件源码来自`hub/plugins/qcu-study-coach`，Skill来自`skills/chengyuan-study-coach/SKILL.md`，`skill-content.js`按现有`stage-study-coach-pilot.py`的JSON字符串生成规则一致。包含通用学习指导，没有用户材料、账号、私有路径或密钥。测试只读取/暂存，不执行JS。

其余fixture是Python标准库`tarfile` USTAR、`gzip`和`zipfile`生成的合成数据：`SKILL.md`描述synthetic ZIP test；权限0600；ZIP时间固定2026-01-01，gzip时间0。恶意样例故意包含`../`、链接、截断、坏CRC/deflate、拼接gzip或9MiB重复A的压缩炸弹。`zip-bomb-forged-size`还将本地头和中央目录展开尺寸伪造成正常Skill长度，以验证真实展开上限。不要用系统解包器将恶意fixture展开到用户目录。

`loopback.py`只用于XCTest。它接受测试临时目录、绑定`127.0.0.1`随机端口，提供GET-only文件响应；故障模式由测试直接写本地`mode.json`选择，没有网络控制接口。测试结束终止其自有进程并清理目录。它不属于助手运行时，也不监听LAN。
