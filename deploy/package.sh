#!/usr/bin/env bash
# Package the project for VPS deployment:
#  1. Exports the current DB + MinIO media into ./deploy/backup
#  2. Creates inspo-deploy.zip with the code, deploy scripts and backup,
#     excluding heavy/local files (node_modules, .venv, .git, sample images, .env...).
#
# Run on your dev machine:
#   bash deploy/package.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo ">>> Exporting data..."
bash deploy/export-data.sh

ZIP="$ROOT/inspo-deploy.zip"
rm -f "$ZIP"

echo ">>> Building $ZIP ..."
zip -r "$ZIP" . \
  -x '.git/*' \
  -x '.venv/*' \
  -x 'node_modules/*' \
  -x 'frontend/node_modules/*' \
  -x 'SampleImages/*' \
  -x 'data/*' \
  -x 'backend/data/*' \
  -x 'frontend/dist/*' \
  -x '__pycache__/*' \
  -x '*.pyc' \
  -x '*.tsbuildinfo' \
  -x '.DS_Store' \
  -x '.env' \
  -x 'inspo-deploy.zip' >/dev/null

echo
echo "Package created. Upload to the VPS, then:"
echo "  unzip inspo-deploy.zip"
echo "  bash deploy/setup.sh"
echo "  docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --build"
echo "  bash deploy/import-data.sh"
