#!/usr/bin/env bash
# 批量打包 ../skills 下所有含 SKILL.md 的目录到 data/skills，并打印 catalog 片段提示
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:-0.1.0}"
SRC="${ROOT}/../skills"
OUT="${ROOT}/data/skills"
mkdir -p "${OUT}"

shopt -s nullglob
for dir in "${SRC}"/*/ ; do
  [[ -f "${dir}/SKILL.md" ]] || continue
  id="$(basename "${dir}")"
  echo "[batch] ${id} @ ${VERSION}"
  bash "${ROOT}/scripts/publish-skill.sh" "${dir}" "${id}" "${VERSION}"
done
echo "[batch] done. 请确认 data/catalog.json 中 status=published 且 file 字段正确。"
