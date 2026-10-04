#!/usr/bin/env bash
# 城院 DSH 本机引导（macOS）
# 不替代官方 dsh；固定预览版版本，并可选安装城院 skill 安装器。
# 每位师生本机运行 DSH Web（127.0.0.1:3080），仅共用局域网目录站下载安装器/技能。
# CHENGYUAN_CATALOG_URL 可覆盖目录站；启动 DSH 时也需保留该环境变量。
set -euo pipefail

DSH_VERSION="${DSH_VERSION:-0.1.5-rc.2}"
CATALOG_URL="${CHENGYUAN_CATALOG_URL:-http://127.0.0.1:8080}"
CATALOG_URL="${CATALOG_URL%/}"
INSTALLER_TGZ="chengyuan-skill-installer-0.1.0.tgz"
INSTALL_INSTALLER="${INSTALL_INSTALLER:-1}"
BIN_DIR="${CHENGYUAN_BIN_DIR:-$HOME/.local/bin}"

echo "[chengyuan-dsh] Node 检查…"
if ! command -v node >/dev/null 2>&1; then
  echo "未找到 node。请先安装 Node.js 18+（建议 20+）：https://nodejs.org/" >&2
  exit 1
fi
NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "${NODE_MAJOR}" -lt 18 ]]; then
  echo "需要 Node.js >= 18，当前: $(node -v)" >&2
  exit 1
fi
echo "[chengyuan-dsh] node $(node -v)"

echo "[chengyuan-dsh] 预取 @deepseek-ai/dsh@${DSH_VERSION}…"
npx --yes "@deepseek-ai/dsh@${DSH_VERSION}" --version >/dev/null

mkdir -p "${BIN_DIR}"
START_SH="${BIN_DIR}/chengyuan-dsh-web"
cat > "${START_SH}" <<EOF
#!/usr/bin/env bash
exec npx --yes @deepseek-ai/dsh@${DSH_VERSION} web "\$@"
EOF
chmod +x "${START_SH}"
echo "[chengyuan-dsh] 启动脚本: ${START_SH}"

MODEL_EXAMPLE="$(cd "$(dirname "$0")" && pwd)/templates/model-config.env.example"
if [[ -f "${MODEL_EXAMPLE}" ]]; then
  mkdir -p "$HOME/.dsh"
  if [[ ! -f "$HOME/.dsh/chengyuan-model.env.example" ]]; then
    cp "${MODEL_EXAMPLE}" "$HOME/.dsh/chengyuan-model.env.example"
    echo "[chengyuan-dsh] 已复制模型配置模板 -> ~/.dsh/chengyuan-model.env.example"
  fi
fi

if [[ "${INSTALL_INSTALLER}" == "1" ]]; then
  echo "[chengyuan-dsh] 安装城院 Skill 安装器（来自 ${CATALOG_URL}）…"
  TMP_TGZ="$(mktemp -t chengyuan-installer.XXXXXX).tgz"
  if curl -fsSL -o "${TMP_TGZ}" "${CATALOG_URL}/plugins/${INSTALLER_TGZ}"; then
    npx --yes "@deepseek-ai/dsh@${DSH_VERSION}" plugin --profile web add "${TMP_TGZ}"
    rm -f "${TMP_TGZ}"
    echo "[chengyuan-dsh] 安装器已加入 web profile。请重启 dsh web。"
  else
    rm -f "${TMP_TGZ}"
    echo "[chengyuan-dsh] 警告：无法下载安装器（检查是否接入 目录站所在网络，或检查 CHENGYUAN_CATALOG_URL 指定的目录站）。可稍后手动装。" >&2
  fi
fi

cat <<EOF

下一步：
  每位师生使用本机 DSH，仅共用局域网目录站下载安装器/技能。
  1) 本机启动 DSH Web：${START_SH} --no-open
             浏览器打开 http://127.0.0.1:3080
  2) 设置 → Models：填入国内 API Key（参考 ~/.dsh/chengyuan-model.env.example，勿提交真实 Key）
  3) 打开局域网目录站（下载安装器/技能）：${CATALOG_URL}/
  4) 对话里：列出并安装通用 skill（如 chengyuan-study-coach）
  如设置了 CHENGYUAN_CATALOG_URL，启动 DSH 时也需保留该环境变量。

详细说明见同目录上级 docs/10分钟上手.md
EOF
