#!/usr/bin/env bash
# Pull latest code on the VPS and rebuild/restart containers.
# Data (SQLite + MinIO) lives in Docker volumes — this does NOT wipe them.
#
#   cd ~/inspo && bash deploy/update.sh
#
# Options (environment):
#   DEPLOY_BRANCH=main     branch to pull (default: current branch's upstream or main)
#   SKIP_GIT=1             skip git pull (rebuild only)
#   BACKUP_BEFORE=1        run deploy/export-data.sh before rebuild (needs stack up)
#   COMPOSE_MODE=prod|dev    force compose files; default: auto from .env
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: Docker Compose plugin is required (docker compose version)."
  exit 1
fi

if [ "${BACKUP_BEFORE:-0}" = "1" ]; then
  echo "Backing up DB + MinIO to deploy/backup/ ..."
  bash "$ROOT/deploy/export-data.sh"
fi

if [ "${SKIP_GIT:-0}" != "1" ]; then
  if [ ! -d .git ]; then
    echo "ERROR: $ROOT is not a git clone. Use deploy/clone-on-vps.sh first, or set SKIP_GIT=1."
    exit 1
  fi
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "WARNING: Working tree has local changes. Stashing before pull..."
    git stash push -u -m "deploy/update.sh $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  fi
  BRANCH="${DEPLOY_BRANCH:-}"
  if [ -z "$BRANCH" ]; then
    BRANCH="$(git rev-parse --abbrev-ref HEAD)"
    if [ "$BRANCH" = "HEAD" ]; then
      BRANCH="main"
    fi
  fi
  echo "Fetching and pulling origin/$BRANCH ..."
  git fetch origin "$BRANCH"
  git pull --ff-only origin "$BRANCH"
fi

compose_mode="${COMPOSE_MODE:-auto}"
if [ "$compose_mode" = "auto" ]; then
  if [ -f .env ] && grep -qE '^SHOP1_DOMAIN=.+\..+' .env 2>/dev/null; then
    compose_mode="prod"
  else
    compose_mode="dev"
  fi
fi

compose=(docker compose)
if [ -f .env ]; then
  compose+=(--env-file .env)
fi
compose+=(-f docker-compose.yml)
if [ "$compose_mode" = "prod" ]; then
  compose+=(-f docker-compose.prod.yml)
  echo "Compose: production (Caddy + HTTPS)"
else
  echo "Compose: development-style (published ports — typical for IP-only VPS)"
fi

echo "Building and restarting ..."
"${compose[@]}" up -d --build

echo
echo "Done. Check: docker compose ps"
if [ "$compose_mode" = "dev" ] && [ -f .env ]; then
  echo "Tip: set MINIO_PUBLIC_URL in .env to your public shop URL + /inspo-media/ if images break after deploy."
fi
