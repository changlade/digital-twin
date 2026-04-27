#!/usr/bin/env bash
# Full DairyFlow app deploy: bundle upload + app code push.
#
# Usage:
#   ./scripts/deploy_app.sh [--target demo] [--profile DEFAULT] [--skip-build]
#
# Options:
#   --target   Bundle target (default: demo)
#   --profile  Databricks CLI profile (default: DEFAULT)
#   --skip-build  Skip the React frontend build step
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="demo"
PROFILE="DEFAULT"
SKIP_BUILD=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)   TARGET="$2";   shift 2 ;;
    --profile)  PROFILE="$2";  shift 2 ;;
    --skip-build) SKIP_BUILD=true; shift ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

# Resolve app name from bundle variable default for the target
APP_NAME=$(databricks bundle validate --target "$TARGET" --profile "$PROFILE" --output json 2>/dev/null \
  | python3 -c "import json,sys; b=json.load(sys.stdin); print(b.get('variables',{}).get('app_name',{}).get('value','danone-dairyflow'))" 2>/dev/null \
  || echo "danone-dairyflow")

echo "==> Target  : $TARGET"
echo "==> Profile : $PROFILE"
echo "==> App     : $APP_NAME"

# Step 1 – Build frontend (unless skipped)
if [ "$SKIP_BUILD" = false ]; then
  echo ""
  echo "==> Building frontend..."
  bash "$REPO_ROOT/scripts/build_frontend.sh"
fi

# Step 2 – Bundle deploy (uploads files + provisions pipeline/jobs/app resource)
echo ""
echo "==> Deploying bundle..."
databricks bundle deploy --target "$TARGET" --profile "$PROFILE"

# Step 3 – Upload static/ separately (gitignored, so bundle deploy skips it)
BUNDLE_FILES_PATH=$(databricks bundle validate --target "$TARGET" --profile "$PROFILE" --output json 2>/dev/null \
  | python3 -c "import json,sys; b=json.load(sys.stdin); print(b.get('workspace',{}).get('file_path',''))" 2>/dev/null \
  || echo "")

SOURCE_CODE_PATH="${BUNDLE_FILES_PATH}/apps/dairyflow/backend"
STATIC_LOCAL="$REPO_ROOT/apps/dairyflow/backend/static"
STATIC_REMOTE="${SOURCE_CODE_PATH}/static"

echo ""
echo "==> Uploading static frontend to workspace..."
echo "    $STATIC_LOCAL → $STATIC_REMOTE"
databricks workspace import-dir "$STATIC_LOCAL" "$STATIC_REMOTE" \
  --overwrite --profile "$PROFILE"

# Step 4 – App deploy (snapshots the full backend dir, now with static/)
echo ""
echo "==> Deploying app from: $SOURCE_CODE_PATH"
databricks apps deploy "$APP_NAME" \
  --source-code-path "$SOURCE_CODE_PATH" \
  --profile "$PROFILE"

echo ""
echo "Done! App is live:"
databricks apps get "$APP_NAME" --profile "$PROFILE" --output json 2>/dev/null \
  | python3 -c "import json,sys; a=json.load(sys.stdin); print(' ', a.get('url',''))" 2>/dev/null || true
