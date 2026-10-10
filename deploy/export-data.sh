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

echo "Writing manifest (checksums + row counts)..."
EXPORTED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
DB_SHA="$(shasum -a 256 "$BACKUP/inspo.db" | awk '{print $1}')"
MINIO_SHA="$(shasum -a 256 "$BACKUP/minio-data.tar.gz" | awk '{print $1}')"
DB_BYTES="$(stat -f%z "$BACKUP/inspo.db" 2>/dev/null || stat -c%s "$BACKUP/inspo.db")"
MINIO_BYTES="$(stat -f%z "$BACKUP/minio-data.tar.gz" 2>/dev/null || stat -c%s "$BACKUP/minio-data.tar.gz")"

python3 - "$BACKUP/manifest.json" "$EXPORTED_AT" "$DB_SHA" "$MINIO_SHA" "$DB_BYTES" "$MINIO_BYTES" "$BACKUP/inspo.db" <<'PY'
import json
import sqlite3
import sys

out, exported_at, db_sha, minio_sha, db_bytes, minio_bytes, db_path = sys.argv[1:8]
conn = sqlite3.connect(db_path)
counts = {}
for table in (
    "tenants",
    "users",
    "products",
    "product_images",
    "media",
    "categories",
    "collections",
    "home_content",
    "pages",
    "page_blocks",
    "blog_posts",
    "editorial_items",
    "site_settings",
):
    counts[table] = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
tenants = [
    {"id": r[0], "slug": r[1], "name": r[2]}
    for r in conn.execute("SELECT id, slug, name FROM tenants ORDER BY id")
]
conn.close()

payload = {
    "version": 1,
    "exported_at_utc": exported_at,
    "includes": [
        "sqlite:/data/inspo.db (all tenants, catalog, CMS, admin users, site settings)",
        "minio:inspo-media (uploaded object store for media URLs in the DB)",
    ],
    "excludes": [
        "docker-compose .env secrets (copy separately if needed)",
        "SampleImages/ (source files only; objects live in MinIO after upload)",
        "frontend/node_modules, git history",
    ],
    "files": {
        "inspo.db": {"bytes": int(db_bytes), "sha256": db_sha},
        "minio-data.tar.gz": {"bytes": int(minio_bytes), "sha256": minio_sha},
    },
    "tenants": tenants,
    "row_counts": counts,
}
with open(out, "w", encoding="utf-8") as f:
    json.dump(payload, f, indent=2)
    f.write("\n")
print("manifest ok")
PY

echo "Verifying backup..."
bash "$DIR/verify-backup.sh"

echo "Done. Backup written to:"
ls -lh "$BACKUP"
