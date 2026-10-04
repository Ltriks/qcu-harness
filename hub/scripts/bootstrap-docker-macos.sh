#!/usr/bin/env bash
# macOS（无头 Mac mini）准备 Docker：Xcode CLT → Homebrew → Colima + Docker CLI
# 必须在机器本地交互执行（需要输入开机密码 / 点安装弹窗），例如：
#   ssh -t user@catalog.example 'bash -s' < scripts/bootstrap-docker-macos.sh
# 或登录后：
#   bash ~/skill-catalog-mvp/scripts/bootstrap-docker-macos.sh
set -euo pipefail

log() { printf '[bootstrap-macos] %s\n' "$*"; }

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# ---- 1) Xcode Command Line Tools ----
if ! xcode-select -p >/dev/null 2>&1; then
  log "未检测到 Xcode CLT，尝试触发安装（可能弹出 GUI，请点「安装」）…"
  xcode-select --install 2>/dev/null || true
  echo
  echo "请在屏幕上完成「Command Line Tools」安装后，重新运行本脚本。"
  echo "无显示器时可用：软件更新里装 CLT，或："
  echo "  touch /tmp/.com.apple.dt.CommandLineTools.installondemand.in-progress"
  echo "  softwareupdate -l"
  echo "  sudo softwareupdate -i \"Command Line Tools for Xcode-XXXX\""
  exit 2
fi
log "Xcode CLT: $(xcode-select -p)"

# ---- 2) Homebrew（清华镜像优先）----
if ! command -v brew >/dev/null 2>&1; then
  log "安装 Homebrew（需要 sudo 密码）…"
  export HOMEBREW_BREW_GIT_REMOTE="https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/brew.git"
  export HOMEBREW_CORE_GIT_REMOTE="https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/homebrew-core.git"
  export HOMEBREW_API_DOMAIN="https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles/api"
  export HOMEBREW_BOTTLE_DOMAIN="https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles"
  NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/install/raw/HEAD/install.sh)" \
    || NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  if [[ -x /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
    # shellcheck disable=SC2016
    grep -q 'brew shellenv' ~/.zprofile 2>/dev/null || echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
  fi
fi
eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || true)"
log "brew: $(brew --version | head -1)"

# 持续用清华 bottle（可选）
export HOMEBREW_API_DOMAIN="${HOMEBREW_API_DOMAIN:-https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles/api}"
export HOMEBREW_BOTTLE_DOMAIN="${HOMEBREW_BOTTLE_DOMAIN:-https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles}"

# ---- 3) Docker CLI + Colima（适合无头，比 Docker Desktop 轻）----
log "安装 docker / colima / docker-compose…"
brew list docker >/dev/null 2>&1 || brew install docker
brew list colima >/dev/null 2>&1 || brew install colima
brew list docker-compose >/dev/null 2>&1 || brew install docker-compose

# Colima 使用国内镜像加速拉取
mkdir -p ~/.colima/default
# 写入 registry mirrors（colima 启动参数）
log "启动 Colima（首次会拉镜像，可能较久）…"
if ! colima status 2>/dev/null | grep -qi running; then
  # --cpu/--memory 可按机器调整；arm64 Mac mini
  colima start --cpu 2 --memory 4 --disk 40 \
    --registry-mirror https://docker.1ms.run \
    --registry-mirror https://docker.xuanyuan.me \
    || {
      log "Colima 默认启动失败，尝试不带 mirror 再启…"
      colima start --cpu 2 --memory 4 --disk 40
    }
fi

docker context use colima >/dev/null 2>&1 || true
docker info >/dev/null
log "docker: $(docker --version)"

log "试拉 nginx:alpine …"
if docker pull nginx:alpine; then
  log "镜像拉取成功"
else
  cat <<'EOF' >&2
[bootstrap-macos] 仍无法拉取 nginx:alpine。
请在本机安装/开启 Clash，设置代理后再试，例如：
  export HTTP_PROXY=http://127.0.0.1:7890 HTTPS_PROXY=http://127.0.0.1:7890 ALL_PROXY=socks5://127.0.0.1:7890
  colima stop && colima start ...
  docker pull nginx:alpine
EOF
  exit 3
fi

log "bootstrap-macos 完成。下一步："
log "  cd ~/skill-catalog-mvp && bash scripts/deploy-catalog.sh"
log "  （部署前请先停掉临时 Ruby 服务: kill \$(cat ~/skill-catalog-mvp/serve.pid)）"
