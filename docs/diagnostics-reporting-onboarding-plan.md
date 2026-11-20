# 基础故障上报：告知后默认开启（2026-11-19）

## 已确认的行为

用户已选择：告知后默认开启，无需老师进入维护页面手动同意。针对没有上报设置的安装，首次进入首页展示非阻塞说明及“关闭自动上报”按钮；说明实际挂载并经历可见绘制后，后台初始化默认值。界面不等待完整故障记录扫描。已有明确开启/关闭按原选择保留。

仅发送已有固定技术字段：故障编号、错误码、阶段、版本、平台等；不含密钥、配置正文、对话或教学资料。接收方沿用固定维护服务。

## 实现

- `lan-report.cjs`（Mac / Windows）：分辨未设置、用户开/关、默认开、接收方变更、不可读。旧 schema2 选择原字节保留；新 schema3 记录 source=default/user、noticeVersion=1、原有接收方与 policyVersion。默认策略不会伪记为主动同意。
- 原子 create-if-absent 创建设置；并发用户关闭不能被默认初始化覆盖。接收方变更、损坏、权限/写入失败均不自动开启或覆盖。
- `diagnostics-api.cjs` 新增 onboarding 固定操作 inspect / disclosed / disable，无需扫描记录，也不访问上报网络。
- Branding Host/Client 契约、Worker allowlist、首页说明同步接入；远程尚未挂载时仅重试读取连接，变更不自动重试。窗口隐藏或退出首页后不会在未展示说明时开启。关闭优先于未开始的默认请求，过时返回不会改写关闭提示。
- 维护页按钮及文字同步，不再声称默认关闭；后续仍可在“更多 → 使用指南 → 问题与维护 → 诊断与上报”修改。
- `scripts/build-rc452-diag.py` 后续构建会同时带入两份新的 support 模块和 branding Worker，避免只更新页面却未更新本地 API。

## 发送时机与边界

首次初始化仅保存开关；沿用既有启动/故障路径 flush，已有排队记录最迟下次启动尝试发送。不是新增常驻上传或实时心跳服务。网络失败保持本机记录与既有有限重试策略。

既有 rc.4.5.4 ZIP 不变。本轮没有生成新安装包、发布标签、云端部署或改动真实用户设置。新版本号和构建标识必须在下一次打包时统一更新，不能覆盖旧 ZIP。旧版 support 不具备 onboarding API，须与新 branding 同包升级。

## 验证

41 项 Node 检查通过（2026-11-19）：

```sh
rtk proxy node --test tests/diagnostics-onboarding.test.mjs tests/diagnostics-remote.test.mjs tests/home-personalization.test.mjs tests/home-client-integration.test.mjs tests/rc45-reporting.test.cjs
```

覆盖两个平台源码、旧选择、默认来源、接收方变更、损坏、符号链接、写入失败、并发关闭、页面展示顺序、页面离开、窗口隐藏、初始化失败及既有 RPC/首页/发送链路。前端测试使用轻量 hook harness，并非真实 Electron 点击验收。

Windows 原生隔离目录验证使用 C:\QCU454 中既有 Electron 作为 Node 解释器，执行 inspect→disclosed→disable→disclosed，验证 unset→default-enabled→explicit-disabled→explicit-disabled。真实用户偏好摘要前后相同，无模型调用、无网络上报。原生 ACL 检查仍需秒级，后台执行且不阻塞首页。证明文件在本机 `.local/diag-20261119/onboarding/result.json`。

启动全套件测试 `teacher-startup-diagnostics.test.cjs` 另需固定 QCU_INTEGRATED_TEST_KIT 和受信运行时；普通 node --test 启动因缺少环境参数退出，未作为本轮通过项。

## 待后续验收

新包 Electron 真实首启提示、关闭按钮及重启持久性；Mac 安装包原生验收；云端对新 buildId 的接收和真实故障回执。当前“开关开启”不等同于云端已接收，旧版云端 buildId 白名单兼容性须在发布前核对。本轮没有向生产服务发送合成事件。

## 后续交付（2026-11-19）

用户已另行授权双端收尾打包。本功能现纳入 `0.1.0-rc.4.5.5 / rc45.6`；上文“未打包”描述的是实现阶段。最终验收与边界见 [rc.4.5.5 双端验收记录](release-rc455-validation.md)。
