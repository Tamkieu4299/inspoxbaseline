#!/usr/bin/env bash
# Wipe local Docker volumes and restore everything from deploy/backup
# (same state as after export-data.sh). Use when you want a clean slate.
#
#   bash deploy/restore-from-backup.sh          # asks for confirmation
#   bash deploy/restore-from-backup.sh --yes    # non-interactive
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"
YES=false
if [ "${1:-}" = "--yes" ] || [ "${1:-}" = "-y" ]; then
  YES=true
fi

bash "$DIR/verify-backup.sh" >/dev/null

if [ "$YES" != true ]; then
  echo "This will:"
  echo "  1. docker compose down -v   (delete backend-data + minio-data volumes)"
  echo "  2. docker compose up -d     (fresh empty volumes)"
  echo "  3. deploy/import-data.sh    (restore inspo.db + MinIO bucket)"
  echo
  read -r -p "Continue? [y/N] " ans
  case "$ans" in
    y|Y|yes|YES) ;;
    *) echo "Aborted."; exit 0 ;;
  esac
fi

cd "$ROOT"
echo "Stopping stack and removing volumes..."
docker compose down -v

echo "Starting stack..."
docker compose up -d

echo "Waiting for MinIO health..."
for _ in $(seq 1 60); do
  if docker inspect -f '{{.State.Running}}' inspo-minio 2>/dev/null | grep -qx true; then
    if docker inspect -f '{{.State.Health.Status}}' inspo-minio 2>/dev/null | grep -qx healthy; then
      break
    fi
  fi
  sleep 2
done

bash "$DIR/import-data.sh"
bash "$DIR/verify-backup.sh"

echo
echo "Restore complete. Storefronts:"
echo "  shop1:     http://localhost:3000"
echo "  baseline:  http://localhost:3001"
echo "  admin:     http://localhost:3000/admin"
