# QCU-MAC-RC451 · Mac Apple Silicon rc.4.5.1

## 目标

以已发布 Mac `0.1.0-rc.4.5` 为基础，制作并对齐 Windows rc.4.5.1 的 Mac arm64 热修包：市场 16.15 + 腾讯云签名目录；验证既有官方内核升级保护；受管组件热修保留 `teacher/0.1.0-rc.4.5` 数据；发布 Mac 专属预发布标签，不改动 Windows 标签/附件，不合并或推送 main。

## 约束

- 工作树：`.work/release-rc45`，分支可续 `fix/qcu-windows-rc451` 或同树提交。
- 基线 ZIP SHA256：`8d7112cd3f65a20b239d0ab1d4daef46e116cb7170bbf1f0fe7235c7934c0612`。
- 不直接套用 Windows ASAR 补丁；Mac 既有 custom ASAR `759bf095…` 仅校验有效性。
- 不关闭 Gatekeeper / SIP；无苹果公证时明确标注临时签名与分发限制。
- 公开附件仅 ZIP、SHA256、安装说明；不上传用户配置/凭据/详细本机测试元数据。
- Cursor 直接实现，不调用 Codex。

## 实现要点

1. `scripts/build-mac-rc451.py`：stage/pack；更新市场 16.15、build `rc45.2`、接入 `refresh-managed.cjs`。
2. `release/rc451/refresh-managed.cjs`：允许 `mac-arm64` 正式 rc45 seed。
3. 校验 `support/managed-updates.json` 与 ASAR 中 `QCU_MANAGED_UPDATES`；跑 `verify-managed-updates.cjs`。
4. 产出主工作区：`releases/0.1.0-rc.4.5.1/mac-arm64/QCU-Teacher-0.1.0-rc.4.5.1-mac-arm64.zip`。
5. 标签/预发布：`qcu-teacher-v0.1.0-rc.4.5.1-mac-arm64`。

## 验收

在工作树根执行（路径可按本机 stage 调整）：

```bash
cd "$(git rev-parse --show-toplevel)"
BASE=releases/0.1.0-rc.4.5/mac-arm64/QCU-Teacher-0.1.0-rc.4.5-mac-arm64.zip
STAGE=.work/rc451-mac
OUT=releases/0.1.0-rc.4.5.1/mac-arm64
rm -rf "$STAGE"
python3 scripts/build-mac-rc451.py stage --base "$BASE" --stage "$STAGE"
python3 scripts/build-mac-rc451.py pack --stage "$STAGE" --out "$OUT"
# 工作树产物同步到主工作区同名目录后：
test -f /Users/mcq/Repos/cowork/qcu-harness/releases/0.1.0-rc.4.5.1/mac-arm64/QCU-Teacher-0.1.0-rc.4.5.1-mac-arm64.zip
shasum -a 256 /Users/mcq/Repos/cowork/qcu-harness/releases/0.1.0-rc.4.5.1/mac-arm64/QCU-Teacher-0.1.0-rc.4.5.1-mac-arm64.zip
node release/rc451/verify-mac-managed-updates.cjs "$STAGE"
node release/rc451/preserve-check-mac.cjs "$STAGE" "$(pwd)/.work/rc45-mac-final/QCU助手.app/Contents/Resources" || true
# 若无旧 stage，preserve 可用打包内旧 seed 自建基线（脚本内说明）
node release/rc451/mac-market-cloud-check.cjs "$STAGE"
# 原生准备（隔离 Home）：
APP="$STAGE/QCU助手.app"
LAUNCHER="$APP/Contents/MacOS/$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$APP/Contents/Info.plist")"
TEST_HOME="$(mktemp -d)/data"
QCU_TEACHER_TEST_HOME="$TEST_HOME" "$LAUNCHER" --prepare-only
QCU_TEACHER_TEST_HOME="$TEST_HOME" "$LAUNCHER" --prepare-only
codesign --verify --deep --strict "$APP"
# 不执行 spctl --master-disable；记录 Gatekeeper 评估结果即可
spctl --assess --type execute -v "$APP" 2>&1 || true
```

机器验证与 GUI/教师业务验收必须分开记录。通过后创建并推送 Mac 专属 tag + prerelease，不移动 Windows tag。
