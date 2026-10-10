#!/usr/bin/env bash
# Sanity-check deploy/backup before restore or after export.
#
#   bash deploy/verify-backup.sh
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP="$DIR/backup"
DB="$BACKUP/inspo.db"
MINIO="$BACKUP/minio-data.tar.gz"
MANIFEST="$BACKUP/manifest.json"

fail() {
  echo "VERIFY FAILED: $*" >&2
  exit 1
}

[ -f "$DB" ] || fail "missing $DB (run bash deploy/export-data.sh)"
[ -f "$MINIO" ] || fail "missing $MINIO"
[ -s "$DB" ] || fail "inspo.db is empty"
[ -s "$MINIO" ] || fail "minio-data.tar.gz is empty"

if ! sqlite3 "$DB" "PRAGMA integrity_check;" | grep -qx "ok"; then
  fail "SQLite integrity_check failed"
fi

if ! tar tzf "$MINIO" | grep -q '^inspo-media/'; then
  fail "minio archive does not contain inspo-media/"
fi

echo "SQLite tenants:"
sqlite3 -header -column "$DB" "SELECT id, slug, name FROM tenants ORDER BY id;"

echo
echo "Row counts:"
sqlite3 -header -column "$DB" "
SELECT 'tenants' AS entity, COUNT(*) AS n FROM tenants
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'product_images', COUNT(*) FROM product_images
UNION ALL SELECT 'media', COUNT(*) FROM media
UNION ALL SELECT 'categories', COUNT(*) FROM categories
UNION ALL SELECT 'collections', COUNT(*) FROM collections
UNION ALL SELECT 'home_content', COUNT(*) FROM home_content
UNION ALL SELECT 'pages', COUNT(*) FROM pages
UNION ALL SELECT 'page_blocks', COUNT(*) FROM page_blocks
UNION ALL SELECT 'blog_posts', COUNT(*) FROM blog_posts
UNION ALL SELECT 'editorial_items', COUNT(*) FROM editorial_items
UNION ALL SELECT 'site_settings', COUNT(*) FROM site_settings;
"

OBJECT_KEYS="$(sqlite3 "$DB" "SELECT COUNT(*) FROM media WHERE object_key IS NOT NULL AND trim(object_key) != '';")"
echo
echo "Media rows with object_key: $OBJECT_KEYS"

if [ -f "$MANIFEST" ]; then
  echo
  echo "Manifest:"
  cat "$MANIFEST"
else
  echo
  echo "Note: no manifest.json (re-run export-data.sh to generate checksums)."
fi

echo
echo "Backup OK — ready for deploy/import-data.sh or deploy/restore-from-backup.sh"
