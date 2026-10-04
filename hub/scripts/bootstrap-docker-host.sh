#!/usr/bin/env bash
# Install / configure Docker on the catalog host with China-friendly registry mirrors.
# Usage: sudo bash bootstrap-docker-host.sh
set -euo pipefail

log() { printf '[bootstrap] %s\n' "$*"; }

if [[ "${EUID}" -ne 0 ]]; then
  echo "请用 root 或 sudo 运行: sudo bash $0" >&2
  exit 1
fi

if [[ -f /etc/os-release ]]; then
  # shellcheck disable=SC1091
  . /etc/os-release
else
  echo "无法识别系统（缺少 /etc/os-release）" >&2
  exit 1
fi

log "OS: ${PRETTY_NAME:-$ID}"

install_docker_debian_ubuntu() {
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  if [[ ! -f /etc/apt/keyrings/docker.gpg ]]; then
    if curl -fsSL "https://mirrors.aliyun.com/docker-ce/linux/${ID}/gpg" | gpg --dearmor -o /etc/apt/keyrings/docker.gpg; then
      log "Docker apt gpg: aliyun"
    else
      curl -fsSL "https://download.docker.com/linux/${ID}/gpg" | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
      log "Docker apt gpg: official"
    fi
    chmod a+r /etc/apt/keyrings/docker.gpg
  fi
  ARCH="$(dpkg --print-architecture)"
  CODENAME="$(. /etc/os-release && echo "${VERSION_CODENAME}")"
  echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.gpg] https://mirrors.aliyun.com/docker-ce/linux/${ID} ${CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}

install_docker_rhel() {
  if command -v dnf >/dev/null 2>&1; then
    dnf install -y dnf-plugins-core
    dnf config-manager --add-repo https://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo
    dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  else
    yum install -y yum-utils
    yum-config-manager --add-repo https://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo
    yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  fi
  systemctl enable --now docker
}

if command -v docker >/dev/null 2>&1; then
  log "Docker 已安装: $(docker --version)"
else
  log "未检测到 Docker，开始安装…"
  case "${ID}" in
    ubuntu|debian) install_docker_debian_ubuntu ;;
    centos|rhel|rocky|almalinux|fedora) install_docker_rhel ;;
    *)
      echo "暂未自动支持发行版: ${ID}。请手动安装 Docker 后重跑本脚本（仅配镜像）。" >&2
      exit 2
      ;;
  esac
fi

mkdir -p /etc/docker
DAEMON_JSON=/etc/docker/daemon.json

MIRROR_JSON='['
first=1
append_mirror() {
  local m="$1"
  [[ -z "$m" ]] && return
  if [[ $first -eq 1 ]]; then first=0; else MIRROR_JSON+=','; fi
  MIRROR_JSON+="\"${m}\""
}
# 可选：export DOCKER_REGISTRY_MIRROR=https://xxxx.mirror.aliyuncs.com
append_mirror "${DOCKER_REGISTRY_MIRROR:-}"
append_mirror "https://docker.1ms.run"
append_mirror "https://docker.xuanyuan.me"
append_mirror "https://mirror.ccs.tencentyun.com"
MIRROR_JSON+=']'

cat > "${DAEMON_JSON}" <<EOF
{
  "registry-mirrors": ${MIRROR_JSON}
}
EOF

log "daemon.json:"
cat "${DAEMON_JSON}"

systemctl enable docker 2>/dev/null || true
systemctl restart docker
sleep 2
docker info >/dev/null
log "docker info OK"

log "试拉 nginx:alpine …"
if docker pull nginx:alpine; then
  log "镜像拉取成功"
else
  cat <<'EOF' >&2

[bootstrap] 国内镜像仍无法拉取 nginx:alpine。
请在目录站服务器本机配置可用的出网代理后：
  1) 设置 HTTP_PROXY/HTTPS_PROXY/ALL_PROXY（常见 7890）
  2) systemctl restart docker
  3) 再执行: docker pull nginx:alpine

EOF
  exit 3
fi

if id lqtriks >/dev/null 2>&1; then
  usermod -aG docker lqtriks || true
  log "已将 lqtriks 加入 docker 组（需重新登录生效）"
fi

log "bootstrap 完成"
