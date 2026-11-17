# Mac rc.4.5.1 热修验收（2026-11-17）

目标：以已发布 Mac rc.4.5 对齐 Windows rc.4.5.1——市场 16.15、腾讯云签名目录、受管组件热修保留 `teacher/0.1.0-rc.4.5`；验证既有官方内核升级保护，不套用 Windows ASAR 补丁。

## 机器验证（已通过）

- 基线 ZIP SHA256 `8d7112cd…0612`；产物 `QCU-Teacher-0.1.0-rc.4.5.1-mac-arm64.zip` SHA256 `585cd723bd3f2212978640c4146842b33cfdc94450db04250cf04019988db32f`，398160952 字节；CRC 通过。
- 既有 Mac custom ASAR `759bf095…` 未重打；`QCU_MANAGED_UPDATES` 后端阻断验证通过；最低版本政策未改；安全 fuse 未改。
- 市场 16.15，`public-trust` 指向 `https://111.229.103.201`；云目录 17 项 fresh；Hallmark 真实下载/摘要/回执及官方 PluginManager 安装且默认禁用通过；模型调用 0。
- 隔离 Home：最终 ZIP ditto 解压后 codesign verify 通过；首次 prepared、重复 already-prepared；工作区重开标记保留。
- 受管热修：合成正式 rc45 旧 seed → refreshed 至 16.15；`cordis.patch.yml` 用户标记字节保留；额外依赖与工作文件保留；手改市场拒绝覆盖。

## 签名与 Gatekeeper

- 外层应用为临时 ad-hoc 签名，**未经 Apple 公证**。
- `spctl --assess` 结果为 rejected（符合预期）。未关闭 Gatekeeper，未绕过系统保护。
- 首次 GUI 打开需使用者在系统提示中自行允许；不能把本机机器准备结果当作 GUI/教师业务验收。

## 未宣称完成

- 完整 GUI 视觉验收（升级入口隐藏、市场页自动加载观感）。
- 退出重开后的完整界面会话。
- 真实教师业务与模型效果。

证据：`scripts/build-mac-rc451.py`、`release/rc451/*mac*`、`releases/0.1.0-rc.4.5.1/mac-arm64/final-validation.json`。私有测试 Home 不入库、不上传。
