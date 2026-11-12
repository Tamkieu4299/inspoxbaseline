#!/usr/bin/env bash
# Deploy inspoXbaseline to your VPS over SSH (password auth via sshpass).
# Credentials: deploy/vps.credentials (local, gitignored).
#
# Usage:
#   bash deploy/vps-ssh-deploy.sh              # package + upload + deploy (IP mode)
#   bash deploy/vps-ssh-deploy.sh package      # Mac: export + inspo-deploy.zip only
#   bash deploy/vps-ssh-deploy.sh upload       # scp zip to VPS
#   bash deploy/vps-ssh-deploy.sh deploy       # remote: docker + import (needs zip on server)
#   bash deploy/vps-ssh-deploy.sh fix-media    # rewrite image URLs + rebuild frontends
#   bash deploy/vps-ssh-deploy.sh status       # docker ps + health curls on VPS
#
# Requires on Mac: sshpass (brew install hudochenkov/sshpass/sshpass)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CRED="$ROOT/deploy/vps.credentials"
ZIP="$ROOT/inspo-deploy.zip"

die() {
  echo "ERROR: $*" >&2
  exit 1
}

load_credentials() {
  [ -f "$CRED" ] || die "Missing $CRED — copy deploy/vps.credentials.example and fill in values."
  # shellcheck disable=SC1090
  source "$CRED"
  : "${VPS_HOST:?VPS_HOST required in vps.credentials}"
  : "${VPS_USER:?VPS_USER required}"
  : "${VPS_PASSWORD:?VPS_PASSWORD required}"
  VPS_INSTALL_DIR="${VPS_INSTALL_DIR:-/root/inspo}"
  VPS_PUBLIC_IP="${VPS_PUBLIC_IP:-$VPS_HOST}"
  DEPLOY_MODE="${DEPLOY_MODE:-ip}"
}

require_sshpass() {
  command -v sshpass >/dev/null 2>&1 || die "Install sshpass: brew install hudochenkov/sshpass/sshpass"
}

ssh_cmd() {
  sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=20 "${VPS_USER}@${VPS_HOST}" "$@"
}

scp_to_vps() {
  sshpass -p "$VPS_PASSWORD" scp -o StrictHostKeyChecking=no "$1" "${VPS_USER}@${VPS_HOST}:$2"
}

cmd_package() {
  cd "$ROOT"
  docker compose up -d 2>/dev/null || true
  bash deploy/export-data.sh
  bash deploy/verify-backup.sh
  bash deploy/package.sh
  ls -lh "$ZIP"
}

cmd_upload() {
  [ -f "$ZIP" ] || die "Run: bash deploy/vps-ssh-deploy.sh package"
  scp_to_vps "$ZIP" "/root/inspo-deploy.zip"
  echo "Uploaded to ${VPS_USER}@${VPS_HOST}:/root/inspo-deploy.zip"
}

cmd_deploy() {
  ssh_cmd 'bash -s' <<REMOTE
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

if ! command -v unzip >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq unzip curl
fi

if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

INSTALL_DIR="${VPS_INSTALL_DIR}"
mkdir -p "\$INSTALL_DIR"
cd "\$INSTALL_DIR"
unzip -o /root/inspo-deploy.zip >/dev/null

IP="${VPS_PUBLIC_IP}"
JWT=\$(openssl rand -hex 32)
MINIO_PW=\$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9')

if [ "${DEPLOY_MODE}" = "prod" ]; then
  if [ ! -f .env ] || ! grep -qE '^SHOP1_DOMAIN=.+' .env 2>/dev/null; then
    echo "DEPLOY_MODE=prod but .env missing domains. On VPS run: bash deploy/setup.sh"
    exit 1
  fi
  COMPOSE=(docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml)
else
  cat > .env <<EOF
ENVIRONMENT=development
MINIO_PUBLIC_URL=http://\${IP}:3000
JWT_SECRET=\${JWT}
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=\${MINIO_PW}
ADMIN_DEFAULT_PASSWORD=admin123
CORS_ORIGINS=http://\${IP}:3000,http://\${IP}:3001
TRUSTED_HOSTS=*
EOF
  chmod 600 .env
  COMPOSE=(docker compose --env-file .env -f docker-compose.yml -f docker-compose.vps-ip.yml)
fi

echo "Building stack (several minutes on small VPS)..."
"\${COMPOSE[@]}" up -d --build

echo "Waiting for backend health..."
for i in \$(seq 1 90); do
  if curl -sf http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
    break
  fi
  sleep 3
done

bash deploy/import-data.sh
sleep 6

# IP mode: same-origin media via nginx :3000
if [ "${DEPLOY_MODE}" = "ip" ]; then
  sed -i "s|^MINIO_PUBLIC_URL=.*|MINIO_PUBLIC_URL=http://\${IP}:3000|" .env
  docker exec inspo-backend python -c "
from app.database import SessionLocal
from app.config import settings
from sqlalchemy import text
from app.minio_client import ensure_bucket
ensure_bucket()
base = settings.public_base_url.rstrip('/')
bucket = settings.MINIO_BUCKET
db = SessionLocal()
for mid, ok, url in db.execute(text('SELECT id, object_key, url FROM media WHERE object_key IS NOT NULL')).fetchall():
    new = f'{base}/{bucket}/{ok}'
    db.execute(text('UPDATE media SET url=:u WHERE id=:id'), {'u': new, 'id': mid})
db.execute(text('UPDATE product_images SET url = (SELECT m.url FROM media m WHERE m.id = product_images.media_id) WHERE media_id IS NOT NULL'))
db.commit()
db.close()
print('media URLs ->', base)
"
  "\${COMPOSE[@]}" up -d --build frontend frontend-baseline
  docker restart inspo-backend
fi

docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
curl -sf http://127.0.0.1:8000/api/health && echo " API OK"
REMOTE

  echo
  echo "Storefronts (IP mode):"
  echo "  INSPO:    http://${VPS_PUBLIC_IP}:3000"
  echo "  Baseline: http://${VPS_PUBLIC_IP}:3001"
  echo "  Admin:    /admin on each (default admin123 — change after login)"
}

cmd_fix_media() {
  ssh_cmd 'bash -s' <<REMOTE
set -euo pipefail
cd "${VPS_INSTALL_DIR}"
IP="${VPS_PUBLIC_IP}"
sed -i "s|^MINIO_PUBLIC_URL=.*|MINIO_PUBLIC_URL=http://\${IP}:3000|" .env
docker exec inspo-backend python -c "
from app.database import SessionLocal
from app.config import settings
from sqlalchemy import text
from app.minio_client import ensure_bucket
ensure_bucket()
base = settings.public_base_url.rstrip('/')
bucket = settings.MINIO_BUCKET
db = SessionLocal()
for mid, ok, url in db.execute(text('SELECT id, object_key, url FROM media WHERE object_key IS NOT NULL')).fetchall():
    db.execute(text('UPDATE media SET url=:u WHERE id=:id'), {'u': f'{base}/{bucket}/{ok}', 'id': mid})
db.execute(text('UPDATE product_images SET url = (SELECT m.url FROM media m WHERE m.id = product_images.media_id) WHERE media_id IS NOT NULL'))
db.commit()
db.close()
"
docker compose --env-file .env -f docker-compose.yml -f docker-compose.vps-ip.yml up -d --build frontend frontend-baseline
docker restart inspo-backend
REMOTE
  echo "Media fix applied on ${VPS_HOST}"
}

cmd_status() {
  ssh_cmd "cd ${VPS_INSTALL_DIR} && docker ps --format 'table {{.Names}}\t{{.Status}}' && curl -sf http://127.0.0.1:8000/api/health && echo health_ok"
}

main() {
  load_credentials
  require_sshpass
  ACTION="${1:-all}"
  case "$ACTION" in
    package) cmd_package ;;
    upload) cmd_upload ;;
    deploy) cmd_deploy ;;
    fix-media) cmd_fix_media ;;
    status) cmd_status ;;
    all)
      cmd_package
      cmd_upload
      cmd_deploy
      ;;
    *)
      die "Unknown action: $ACTION (package|upload|deploy|fix-media|status|all)"
      ;;
  esac
}

main "$@"
