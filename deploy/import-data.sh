#!/usr/bin/env bash
# Restore the exported DB + media into the VPS stack.
#
# Run AFTER the stack is up for the first time (containers inspo-backend/inspo-minio
# must be running so their volumes exist):
#   docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --build
#   bash deploy/import-data.sh
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP="$DIR/backup"

for c in inspo-backend inspo-minio; do
  if ! docker inspect -f '{{.State.Running}}' "$c" >/dev/null 2>&1; then
    echo "ERROR: $c is not running. Start the stack first (see header comment)."
    exit 1
  fi
done

if [ ! -f "$BACKUP/inspo.db" ] || [ ! -f "$BACKUP/minio-data.tar.gz" ]; then
  echo "ERROR: $BACKUP is missing inspo.db / minio-data.tar.gz."
  echo "Copy the backup (export-data.sh output) from your dev machine to this folder."
  exit 1
fi

echo "Restoring MinIO media..."
docker run --rm \
  --volumes-from inspo-minio \
  -v "$BACKUP":/backup \
  alpine tar xzf /backup/minio-data.tar.gz -C /data

echo "Restoring database..."
docker cp "$BACKUP/inspo.db" inspo-backend:/data/inspo.db

echo "Restarting backend so seed migrations run against the restored DB"
echo "(media URLs are rewritten to MINIO_PUBLIC_URL automatically)..."
docker restart inspo-backend

echo
echo "Done. Verify:"
echo "  docker exec inspo-backend ls -la /data/inspo.db"
echo "  docker logs inspo-backend | tail -5"
