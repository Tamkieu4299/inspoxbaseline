#!/usr/bin/env bash
# One-time: clone the GitHub repo on the VPS (then configure .env and run deploy/update.sh).
#
#   bash deploy/clone-on-vps.sh
#
# Environment:
#   GIT_REPO=git@github.com:ORG/REPO.git   default: origin URL from your dev machine's git remote
#   INSTALL_DIR=~/inspo                     where to clone
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-$HOME/inspo}"
GIT_REPO="${GIT_REPO:-https://github.com/Tamkieu4299/inspoxbaseline.git}"

if [ -d "$INSTALL_DIR/.git" ]; then
  echo "Already cloned at $INSTALL_DIR — run: cd $INSTALL_DIR && bash deploy/update.sh"
  exit 0
fi

if ! command -v git >/dev/null 2>&1; then
  echo "Install git first (e.g. apt install -y git)."
  exit 1
fi

mkdir -p "$(dirname "$INSTALL_DIR")"
echo "Cloning $GIT_REPO -> $INSTALL_DIR"
git clone "$GIT_REPO" "$INSTALL_DIR"
cd "$INSTALL_DIR"

echo
echo "Next steps on this VPS:"
echo "  1. Create .env (never commit this file):"
echo "       bash deploy/setup.sh          # domains + HTTPS (recommended when DNS is ready)"
echo "     or copy your existing .env from a zip deploy."
echo "  2. First run / update:"
echo "       bash deploy/update.sh"
echo "  3. If this is a fresh server with empty volumes, restore data once:"
echo "       bash deploy/import-data.sh    # needs deploy/backup/ from package.sh"
echo
echo "For private GitHub repos, use an SSH deploy key:"
echo "  ssh-keygen -t ed25519 -f ~/.ssh/inspo_deploy -N ''"
echo "  cat ~/.ssh/inspo_deploy.pub  # add as read-only Deploy key on GitHub"
echo "  GIT_REPO=git@github.com:Tamkieu4299/inspoxbaseline.git bash deploy/clone-on-vps.sh"
