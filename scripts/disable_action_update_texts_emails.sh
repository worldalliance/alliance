#!/usr/bin/env bash
# Usage: disable_action_update_texts_emails.sh [staging|prod] [--apply]
set -euo pipefail

TARGET="${1:-staging}"
APPLY=false
[[ "${2:-}" == "--apply" ]] && APPLY=true

case "$TARGET" in
  staging) PREFIX=STAGING ;;
  prod) PREFIX=PROD ;;
  *)
    echo "target must be staging or prod, got: $TARGET" >&2
    exit 1
    ;;
esac

SSH_HOST_ALIAS="${SSH_HOST_ALIAS:-staging}"
REMOTE_ENV_FILE="${REMOTE_ENV_FILE:-/home/ec2-user/db-sync.env}"
SQL_FILE="$(dirname "$0")/disable_action_update_texts_emails.sql"

echo "==> ${TARGET} db via SSH host ${SSH_HOST_ALIAS}, apply=${APPLY}"

ssh -o BatchMode=yes "$SSH_HOST_ALIAS" "bash -lc '
  set -euo pipefail
  source \"${REMOTE_ENV_FILE}\"
  URL=\"postgresql://\${${PREFIX}_DB_USER}:\${${PREFIX}_DB_PASSWORD}@\${${PREFIX}_DB_HOST}:5432/\${${PREFIX}_DB_NAME}\"
  exec psql \"\$URL\" -X -v apply=${APPLY}
'" < "$SQL_FILE"
