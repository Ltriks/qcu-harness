#!/bin/bash
set -euo pipefail
launcher="$HOME/Library/Application Support/QCU-DSH/offline/0.1.0-rc.1/Start-QCU-DSH.command"
if [ ! -x "$launcher" ]; then
  echo '请先运行 02-install-QCU.command 完成本地安装。'
  read -r -p '按回车关闭。' _
  exit 1
fi
exec "$launcher"
