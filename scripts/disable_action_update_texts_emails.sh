#!/usr/bin/env bash
# Usage: disable_action_update_texts_emails.sh [staging|prod] [--apply]
set -euo pipefail

TARGET="${1:-staging}"
APPLY=false
[[ "${2:-}" == "--apply" ]] && APPLY=true

case "$TARGET" in
  staging) ENVIRONMENT=staging ;;
  prod) ENVIRONMENT=production ;;
  *)
    echo "target must be staging or prod, got: $TARGET" >&2
    exit 1
    ;;
esac

SSH_HOST_ALIAS="${SSH_HOST_ALIAS:-$TARGET}"
SQL_FILE="$(dirname "$0")/disable_action_update_texts_emails.sql"

echo "==> ${TARGET} db via SSH host ${SSH_HOST_ALIAS}, apply=${APPLY}"

# shellcheck disable=SC2029 # both values are validated above
ssh "$SSH_HOST_ALIAS" \
  "bash nest-backend/scripts/with_db_env.sh ${ENVIRONMENT} psql -X -v apply=${APPLY}" \
  < "$SQL_FILE"
