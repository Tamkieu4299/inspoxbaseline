#!/usr/bin/env bash
# One-time setup on the VPS: prompts for your domains + Let's Encrypt email,
# generates strong random secrets, and writes the .env used by the prod compose.
#
#   bash deploy/setup.sh
#
# Non-interactive: set SHOP1_DOMAIN, BASELINE_DOMAIN, MEDIA_DOMAIN, CERT_EMAIL in
# your environment and it will skip the prompts.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env"

if ! docker compose version 2>/dev/null | grep -q "Docker Compose version v2"; then
  echo "ERROR: Docker Compose v2 is required (uses compose '!reset' override syntax)."
  exit 1
fi

if [ -f "$ENV_FILE" ]; then
  read -r -p ".env already exists — overwrite? (y/N): " answer
  case "$answer" in
    y|Y|yes|YES) ;;
    *) echo "Aborted. Existing .env kept."; exit 1 ;;
  esac
fi

SHOP1_DOMAIN="${SHOP1_DOMAIN:-}"
BASELINE_DOMAIN="${BASELINE_DOMAIN:-}"
MEDIA_DOMAIN="${MEDIA_DOMAIN:-}"
CERT_EMAIL="${CERT_EMAIL:-}"

if [ -z "$SHOP1_DOMAIN" ]; then
  read -r -p "Shop 1 storefront domain (e.g. inspo.example.com): " SHOP1_DOMAIN
fi
if [ -z "$BASELINE_DOMAIN" ]; then
  read -r -p "Shop 2 (baseline) storefront domain (e.g. baseline.example.com): " BASELINE_DOMAIN
fi
if [ -z "$MEDIA_DOMAIN" ]; then
  read -r -p "Media hostname — leave empty for media.${SHOP1_DOMAIN}: " MEDIA_DOMAIN
  [ -n "$MEDIA_DOMAIN" ] || MEDIA_DOMAIN="media.${SHOP1_DOMAIN}"
fi
if [ -z "$CERT_EMAIL" ]; then
  read -r -p "Email for Let's Encrypt certificates (e.g. you@example.com): " CERT_EMAIL
fi

for var in SHOP1_DOMAIN BASELINE_DOMAIN MEDIA_DOMAIN CERT_EMAIL; do
  if [ -z "${!var}" ]; then
    echo "ERROR: $var is required."
    exit 1
  fi
done

# --- Secrets (openssl rand) ---
JWT_SECRET="$(openssl rand -hex 32)"
MINIO_ROOT_PASSWORD="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9')"
ADMIN_PW_BASE="$(openssl rand -base64 12 | tr -dc 'A-Za-z0-9' | cut -c1-12)"
ADMIN_DEFAULT_PASSWORD="${ADMIN_PW_BASE}A1!"

cat > "$ENV_FILE" <<EOF
ENVIRONMENT=production
SHOP1_DOMAIN=$SHOP1_DOMAIN
BASELINE_DOMAIN=$BASELINE_DOMAIN
MEDIA_DOMAIN=$MEDIA_DOMAIN
CERT_EMAIL=$CERT_EMAIL
CORS_ORIGINS=https://$SHOP1_DOMAIN,https://$BASELINE_DOMAIN
TRUSTED_HOSTS=$SHOP1_DOMAIN,$BASELINE_DOMAIN,$MEDIA_DOMAIN,localhost,127.0.0.1
JWT_SECRET=$JWT_SECRET
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=$MINIO_ROOT_PASSWORD
ADMIN_DEFAULT_PASSWORD=$ADMIN_DEFAULT_PASSWORD
EOF

chmod 600 "$ENV_FILE"

echo
echo ".env written to $ENV_FILE"
echo
echo "Next steps:"
echo "  1. Point DNS A-records for $SHOP1_DOMAIN, $BASELINE_DOMAIN and $MEDIA_DOMAIN at this VPS."
echo "  2. docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --build"
echo "  3. bash deploy/import-data.sh   (only if you exported deploy/backup from your dev machine)"
echo "  4. Open https://$SHOP1_DOMAIN/admin and reset each tenant admin password."
echo
echo "ADMIN_DEFAULT_PASSWORD (used only for a fresh database): $ADMIN_DEFAULT_PASSWORD"
