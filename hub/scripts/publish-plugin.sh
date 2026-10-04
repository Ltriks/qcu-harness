#!/usr/bin/env bash
# Pack a DSH plugin directory into data/plugins/<id>-<version>.tgz
# Usage:
#   ./publish-plugin.sh plugins/chengyuan-skill-installer
#   ./publish-plugin.sh plugins/chengyuan-skill-installer 0.1.1
set -euo pipefail

PLUGIN_DIR="${1:?plugin dir}"
VERSION_OVERRIDE="${2:-}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN_DIR="$(cd "${PLUGIN_DIR}" && pwd)"

if [[ ! -f "${PLUGIN_DIR}/package.json" ]]; then
  echo "缺少 ${PLUGIN_DIR}/package.json" >&2
  exit 1
fi

NAME="$(node -p "require('${PLUGIN_DIR}/package.json').name")"
VERSION="${VERSION_OVERRIDE:-$(node -p "require('${PLUGIN_DIR}/package.json').version")}"
OUT_NAME="${NAME}-${VERSION}.tgz"
OUT_DIR="${ROOT}/data/plugins"
mkdir -p "${OUT_DIR}"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

(
  cd "${PLUGIN_DIR}"
  # npm pack 写入当前目录；复制到 data/plugins 并统一命名
  packed="$(npm pack --silent)"
  mv -f "${packed}" "${TMP}/${OUT_NAME}"
)

cp -f "${TMP}/${OUT_NAME}" "${OUT_DIR}/${OUT_NAME}"
# 清掉源码目录里可能残留的 npm pack 产物
rm -f "${PLUGIN_DIR}/${NAME}-${VERSION}.tgz" "${PLUGIN_DIR}/${NAME}"-*.tgz 2>/dev/null || true

echo "[publish-plugin] wrote ${OUT_DIR}/${OUT_NAME}"
echo "[publish-plugin] 请更新 data/catalog.json 中 plugins[]: file=${OUT_NAME}, install 命令指向 /plugins/${OUT_NAME}"
