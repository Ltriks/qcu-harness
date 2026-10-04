#!/usr/bin/env bash
# Publish a skill directory as zip into catalog data/ (local or via scp).
# Usage:
#   ./publish-skill.sh /path/to/skill-dir chengyuan-acct-entry-coach 0.1.0
# Optional:
#   CATALOG_HOST=user@catalog.example CATALOG_REMOTE_DIR=~/skill-catalog-mvp ./publish-skill.sh ...
set -euo pipefail

SKILL_DIR="${1:?skill dir}"
SKILL_ID="${2:?skill id}"
VERSION="${3:?version}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_NAME="${SKILL_ID}-${VERSION}.zip"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [[ ! -f "${SKILL_DIR}/SKILL.md" ]]; then
  echo "缺少 ${SKILL_DIR}/SKILL.md" >&2
  exit 1
fi

(
  cd "${SKILL_DIR}"
  # zip 根目录为 skill id，便于解压到 ~/.dsh/skills/<id>/
  mkdir -p "${TMP}/${SKILL_ID}"
  cp -R . "${TMP}/${SKILL_ID}/"
  cd "${TMP}"
  zip -qr "${OUT_NAME}" "${SKILL_ID}"
)

mkdir -p "${ROOT}/data/skills"
cp "${TMP}/${OUT_NAME}" "${ROOT}/data/skills/${OUT_NAME}"
echo "[publish] wrote ${ROOT}/data/skills/${OUT_NAME}"
echo "[publish] 请手动更新 data/catalog.json 中对应条目: file=${OUT_NAME}, status=published"

if [[ -n "${CATALOG_HOST:-}" ]]; then
  REMOTE_DIR="${CATALOG_REMOTE_DIR:-~/skill-catalog-mvp}"
  scp "${ROOT}/data/skills/${OUT_NAME}" "${CATALOG_HOST}:${REMOTE_DIR}/data/skills/"
  echo "[publish] scp -> ${CATALOG_HOST}:${REMOTE_DIR}/data/skills/${OUT_NAME}"
  echo "[publish] 远端 catalog.json 需同步更新后刷新页面"
fi
