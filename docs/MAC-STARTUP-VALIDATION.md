# Mac 合成候选启动验收（2026-10-04）

测试源码基于开发分支提交 e9727aebec2fb105eb1b08d01784a96ced20bc3d；官方基线为 639ed015397290b3745d163aafe02ffee4aa3f84。使用独立 checkout、合成 Home 和合成文档，不覆盖原稳定开发版或主工作区，不导入真实论文和模型密钥，不调用模型、不扩展 OS 权限或安全设置。本轮没有修改生产认证、QCU 固定入口、Host 策略或签名门禁。

## 真实根因与恢复

Host、Client 库和 Desktop 叶级构建通过后，apps/web/dist/index.html 尚未生成。测试 bootstrap 在真实 Electron 启动阶段只保存白名单数字/布尔字段，记录到 Host ready、认证交换 303、默认 session cookie 存在；初始页面 GET 返回 404。Host 在该响应时仍存活，随后失败清理才关闭 Host。Host 与 Renderer 实际解析的前端 index 均不存在、不可读。这项现场证据支持缺静态产物的根因，不能从事后端口关闭倒推 Host 未启动，也不能把该 welcome 错误解释为模型密钥缺失。

在同一独立候选执行官方 pnpm run build:web，通过并生成可读 index，随后重新启动同一合成 Home：初始页面返回 200，认证交换仍为 303，默认 session cookie 存在，Host 持续存活。QCU bundle 已选择，私有 hello/ready/granted 握手均完成，工作台 bridge/lock 生成。Host 与 Renderer 前端 index 都可读。无 cookie 的固定根页面请求仍返回 401，认证没有被禁用。

| 观测 | 构建 Web 前 | 构建 Web 后 |
| --- | --- | --- |
| Host ready | true | true |
| 认证交换状态 | 303 | 303 |
| 默认 session cookie 存在 | true | true |
| 初始页面状态 | 404 | 200 |
| 响应时 Host 存活 | true | true |
| 响应后 Host 被清理关闭 | true | false |
| Host/Renderer index 可读 | false/false | true/true |
| QCU 私有 granted 握手 | false | true |
| 工作台 bridge/lock 存在 | false/false | true/true |

安全快照在 [修复前](evidence/mac-web-startup-before.json)、[修复后](evidence/mac-web-startup-after.json) 与 [实际 resolver 检查](evidence/mac-web-artifacts.json)。它们只含数字和布尔值，没有 URL/query、cookie 值、响应正文、个人数据、令牌或私有日志。私有会话材料不随仓库提交，凭据值不能用于诊断输出。

固定基线的官方 pnpm run build 已包含 native-system、Host/Client 库和 build:web。后续重建优先遵循该入口，再构建 Desktop；此次局部恢复仅补 build:web，没有另造构建框架或重复已经通过的大构建。新只读 verify-desktop-web.mjs 提前检查文件；缺少产物时非零退出，Renderer 尚未准备时不宣称检查通过。

## 相关验证与实际范围

官方 web-document.spec.ts 与 qcu-office-entry.spec.ts 共 26 项通过，覆盖静态文档/认证与固定入口。本仓库新的只读检查用 5 项 Mac 合成测试验证前端包缺失、index 缺失、两个 resolver 均可读且原文件未变、只有 Host 可读时拒绝、index 不可读时拒绝且权限未改变。最后一项在 Windows 或 root 下显式跳过，不能把跳过算作该平台通过。Mac 实际完整 resolver 检查通过；既有 Host/Client/Electron 构建及业务包类型/聚焦回归保持独立记录，不重复累计。

实际 Mac 运行时为官方准备的 Node 24.21.0、Python 3.12.14；Electron 自带 Node 24.18.1。锁定工具为 pnpm 11.7.0、TypeScript 6.0.3、Vitest 4.1.8；这不是将 Linux 24.19.0 记录改写为 Mac 环境。冻结依赖复用已有可信缓存，没有下载新包，官方供应链元数据核验通过，安装脚本禁用。Mac 自有 Node QcuService 父进程强杀后 0.026 秒内清理监听与自有记录、同 Home 重启及独立合成服务保留均通过；Linux 专属的三项原用例跳过，不算 Mac 通过。

合成准备脚本曾以 0755 创建 home，被固定入口按预期拒绝；仅修正自有测试目录为 owner-only，不放宽入口检查。失败候选清理仅针对核实过完整命令和父子关系、Host 已退出且监听和 bridge/lock 不存在的自有测试 Electron，不按服务记录 PID 清理其他进程。

## 仍未验收

当前暴露的工具目录没有支持原生窗口或浏览器控件的控制工具，本轮未新增 OS 权限作为替代。因此真实 Electron/Renderer 进程、HTTP、IPC、Python 健康和合成回归不等同 GUI 操作通过。原生文件选择、下载取消及重试、打印预览仍未验收，也不要求用户重复此前旧版已通过的检查。界面内容、卸载/存储、正式签名分发和 Windows 另行验收；本轮不合并 main、不正式发布。
