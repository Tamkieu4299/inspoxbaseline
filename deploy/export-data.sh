#!/usr/bin/env bash
# Export the current SQLite DB + MinIO media from the local Docker volumes into
# ./deploy/backup so the data can be restored on the VPS.
#
# Run on your dev machine BEFORE packaging:
#   bash deploy/export-data.sh
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP="$DIR/backup"
mkdir -p "$BACKUP"

for c in inspo-backend inspo-minio; do
  if ! docker inspect -f '{{.State.Running}}' "$c" >/dev/null 2>&1; then
    echo "ERROR: $c is not running. Start the stack first: docker compose up -d"
    exit 1
  fi
done

echo "Exporting SQLite database (consistent snapshot)..."
docker exec inspo-backend python -c "import sqlite3; s=sqlite3.connect('/data/inspo.db'); d=sqlite3.connect('/data/inspo-export.db'); s.backup(d); d.close(); s.close(); print('snapshot ok')"
docker cp inspo-backend:/data/inspo-export.db "$BACKUP/inspo.db"
docker exec inspo-backend rm -f /data/inspo-export.db

echo "Exporting MinIO media (bucket inspo-media only — excludes server config/credentials)..."
docker run --rm \
  --volumes-from inspo-minio \
  -v "$BACKUP":/backup \
  alpine tar czf /backup/minio-data.tar.gz -C /data inspo-media

echo "Done. Backup written to:"
ls -lh "$BACKUP"
