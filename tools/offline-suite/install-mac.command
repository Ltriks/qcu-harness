#!/bin/bash
set -euo pipefail
kit=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
app=${QCU_DSH_APP:-/Applications/DeepSeek Harness.app}
if [ ! -x "$app/Contents/MacOS/DeepSeek Harness" ]; then
  app="$HOME/Applications/DeepSeek Harness.app"
fi
if [ ! -x "$app/Contents/MacOS/DeepSeek Harness" ]; then
  echo '请先从 client 文件夹安装官方 DeepSeek Harness，再重新打开本安装器。'
  read -r -p '按回车关闭。' _
  exit 1
fi
if /usr/bin/pgrep -f '/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness' >/dev/null; then
  echo '请先正常退出已有 DSH，保留任务后再继续。安装器不会结束现有进程。'
  read -r -p '按回车关闭。' _
  exit 1
fi
resources="$app/Contents/Resources"
export ELECTRON_RUN_AS_NODE=1
unset NODE_OPTIONS
echo '将在独立城院目录安装清单中的十个包；不会修改原有 DSH 数据。'
"$app/Contents/MacOS/DeepSeek Harness" --expose-internals "$kit/installer/offline.cjs" install --kit "$kit" --resources "$resources"
echo
read -r -p '安装完成。现在启用七项文字技能与 QCU 市场？[y/N] ' answer
if [ "$answer" = y ] || [ "$answer" = Y ]; then
  "$app/Contents/MacOS/DeepSeek Harness" --expose-internals "$kit/installer/offline.cjs" activate --kit "$kit" --resources "$resources"
fi
echo '已完成。课程工作台、飞书工具可稍后在官方插件设置中分别启用。'
echo '通过 03-start-QCU.command 打开城院环境；模型设置与飞书授权由本人完成。'
read -r -p '按回车关闭。' _
