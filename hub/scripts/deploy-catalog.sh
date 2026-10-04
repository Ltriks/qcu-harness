#!/usr/bin/env bash
# Deploy skill catalog MVP (macOS Colima / Linux Docker).
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "未找到 docker，请先运行 bootstrap-docker-macos.sh 或 bootstrap-docker-host.sh" >&2
  exit 1
fi

# 优先用 docker context，不要强行 export DOCKER_HOST（Colima 下易踩坑）
if command -v colima >/dev/null 2>&1; then
  if ! docker info >/dev/null 2>&1; then
    echo "[deploy] Docker daemon 不可用，尝试 colima start…"
    colima start
  fi
  docker context use colima >/dev/null 2>&1 || true
fi

if ! docker info >/dev/null 2>&1; then
  echo "无法连接 Docker daemon。请检查: colima status / docker context ls" >&2
  exit 1
fi

COMPOSE=()
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "未找到 docker compose / docker-compose" >&2
  exit 1
fi

mkdir -p data/skills data/plugins serve/skills serve/plugins
touch data/skills/.gitkeep
touch data/plugins/.gitkeep

cp -f web/index.html serve/index.html
cp -f web/themes.html serve/themes.html
cp -f data/catalog.json serve/catalog.json
rm -rf serve/skills serve/plugins
mkdir -p serve/skills serve/plugins
if compgen -G "data/skills/*" >/dev/null 2>&1; then
  # 只复制 zip，避免把目录递归搞乱
  find data/skills -maxdepth 1 -type f -exec cp -f {} serve/skills/ \;
fi
if compgen -G "data/plugins/*" >/dev/null 2>&1; then
  find data/plugins -maxdepth 1 -type f -exec cp -f {} serve/plugins/ \;
fi
touch serve/skills/.keep
touch serve/plugins/.keep

# 只停临时 Ruby，不要误杀 Colima 端口转发
if [[ -f serve.pid ]]; then
  oldpid="$(tr -cd '0-9' < serve.pid || true)"
  if [[ -n "${oldpid}" ]] && kill -0 "${oldpid}" 2>/dev/null; then
    echo "[deploy] 停止临时 Ruby pid=${oldpid}"
    kill "${oldpid}" 2>/dev/null || true
    sleep 1
  fi
  rm -f serve.pid
fi

echo "[deploy] using: ${COMPOSE[*]}"
if docker image inspect nginx:alpine >/dev/null 2>&1; then
  echo "[deploy] 本地已有 nginx:alpine，跳过 pull"
else
  echo "[deploy] 拉取 nginx:alpine …"
  if ! docker pull nginx:alpine; then
    echo "[deploy] pull 失败。请检查 mirror / Clash 后: docker pull nginx:alpine" >&2
    exit 3
  fi
fi

"${COMPOSE[@]}" up -d --force-recreate
"${COMPOSE[@]}" ps

echo "[deploy] smoke"
sleep 2
code="$(curl -fsS -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/ || true)"
echo "GET / -> ${code}"
curl -fsS http://127.0.0.1:8080/catalog.json | head -c 220 || true
echo
if [[ "${code}" != "200" ]]; then
  echo "冒烟失败: ${COMPOSE[*]} logs --tail=80" >&2
  exit 2
fi

# 仅用于成功提示；现网目录站为 127.0.0.1，不改变 Docker 部署配置。
lan_ip="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo 127.0.0.1)"
echo "[deploy] OK  http://${lan_ip}:8080/"
