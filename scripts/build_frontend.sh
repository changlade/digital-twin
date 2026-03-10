#!/usr/bin/env bash
# Build the DairyFlow React frontend and copy the production bundle into the
# backend's static/ directory, which is what Databricks Apps will serve.
#
# Run this once before every `databricks bundle deploy` when frontend files
# have changed.
#
# Usage:
#   ./scripts/build_frontend.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/apps/dairyflow/frontend"
STATIC_DIR="$REPO_ROOT/apps/dairyflow/backend/static"

echo "==> Building DairyFlow frontend..."
cd "$FRONTEND_DIR"

if ! command -v npm &>/dev/null; then
  echo "ERROR: npm is not installed or not in PATH." >&2
  exit 1
fi

npm ci
npm run build

echo "==> Copying dist/ → backend/static/..."
rm -rf "$STATIC_DIR"
mkdir -p "$STATIC_DIR"
cp -r dist/. "$STATIC_DIR/"

echo "Done. Frontend built → apps/dairyflow/backend/static/"
