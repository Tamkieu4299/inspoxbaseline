#!/usr/bin/env bash
# Point both inspo tenants at TamHub order webhook (shared Docker network).
#
# Prerequisites:
#   docker network create inspo-tamhub
#   docker compose -f docker-compose.yml -f docker-compose.tamhub-network.yml up -d
#   TamHub running with docker-compose.vps-coexist.yml
#
# Usage:
#   bash deploy/configure-tamhub-integration.sh
#   ORDER_WEBHOOK_SECRET=your-shared-secret bash deploy/configure-tamhub-integration.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Gateway re-serializes JSON and breaks HMAC; call service-management on the shared network.
WEBHOOK_URL="${TAMHUB_WEBHOOK_URL:-http://tamhub-service-management-service:3004/api/v1/integrations/inspo/orders}"
SECRET="${ORDER_WEBHOOK_SECRET:-}"

if ! docker inspect inspo-backend >/dev/null 2>&1; then
  echo "ERROR: inspo-backend container not running."
  exit 1
fi

export INSPO_WEBHOOK_URL="$WEBHOOK_URL"
docker exec -e INSPO_WEBHOOK_URL inspo-backend python3 -c "
from sqlalchemy import select
from app.database import SessionLocal
from app.models import Tenant, SiteSettings
import os

webhook = os.environ['INSPO_WEBHOOK_URL']
db = SessionLocal()
for slug in ('shop1', 'baseline'):
    tenant = db.scalar(select(Tenant).where(Tenant.slug == slug))
    if not tenant:
        print(f'skip: no tenant {slug}')
        continue
    site = db.scalar(select(SiteSettings).where(SiteSettings.tenant_id == tenant.id))
    if site is None:
        site = SiteSettings(tenant_id=tenant.id, site_name=slug)
        db.add(site)
        db.flush()
    site.order_webhook_url = webhook
    print(f'set order_webhook_url for {slug} -> {webhook}')
db.commit()
db.close()
"

if [ -n "$SECRET" ]; then
  ENV_FILE="$ROOT/.env"
  if [ -f "$ENV_FILE" ]; then
    if grep -q '^ORDER_WEBHOOK_SECRET=' "$ENV_FILE"; then
      if [[ "$(uname)" == Darwin ]]; then
        sed -i '' "s|^ORDER_WEBHOOK_SECRET=.*|ORDER_WEBHOOK_SECRET=$SECRET|" "$ENV_FILE"
      else
        sed -i "s|^ORDER_WEBHOOK_SECRET=.*|ORDER_WEBHOOK_SECRET=$SECRET|" "$ENV_FILE"
      fi
    else
      echo "ORDER_WEBHOOK_SECRET=$SECRET" >> "$ENV_FILE"
    fi
    echo "Updated ORDER_WEBHOOK_SECRET in .env — restart backend: docker compose up -d backend"
  else
    echo "Set ORDER_WEBHOOK_SECRET in .env manually (same as TamHub INSPO_WEBHOOK_SECRET)"
  fi
fi

echo "Done."
