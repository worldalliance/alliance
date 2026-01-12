#!/usr/bin/env bash
set -euo pipefail

source /home/ec2-user/db-sync.env

PROD_URL="postgresql://${PROD_DB_USER}:${PROD_DB_PASSWORD}@${PROD_DB_HOST}:5432/${PROD_DB_NAME}"
STAGING_URL="postgresql://${STAGING_DB_USER}:${STAGING_DB_PASSWORD}@${STAGING_DB_HOST}:5432/${STAGING_DB_NAME}"

STAGING_ADMIN_URL="postgresql://${STAGING_DB_USER}:${STAGING_DB_PASSWORD}@${STAGING_DB_HOST}:5432/postgres"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="/home/ec2-user/prod_dump_${TIMESTAMP}.pgcustom"

echo "[$(date)] ==> Starting prod → staging sync"
echo "[$(date)] ==> Dumping prod database to ${DUMP_FILE}..."

pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  "$PROD_URL" \
  --file="$DUMP_FILE"

echo "[$(date)] ==> Terminating existing connections & recreating staging database..."

psql "$STAGING_ADMIN_URL" -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${STAGING_DB_NAME}'
  AND pid <> pg_backend_pid();

DROP DATABASE IF EXISTS ${STAGING_DB_NAME};
CREATE DATABASE ${STAGING_DB_NAME} WITH TEMPLATE=template0 ENCODING='UTF8';
SQL

echo "[$(date)] ==> Restoring dump into staging database..."

pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname="$STAGING_URL" \
  "$DUMP_FILE"

psql "$STAGING_URL" -v ON_ERROR_STOP=1 <<'SQL'
-- Example: anonymize user emails and clear phone numbers
UPDATE "user"
SET
  "email"      = 'user'||id||'@example.com',
  "phoneNumber" = '15550100';
UPDATE "user" SET "password" = 'pw';

SQL

echo "[$(date)] ==> S3 sync s3://$PROD_ASSETS_BUCKET -> s3://$STAGING_ASSETS_BUCKET"

aws s3 sync \
  "s3://${PROD_ASSETS_BUCKET}/" \
  "s3://${STAGING_ASSETS_BUCKET}/" \
  --only-show-errors \
  --size-only

SYNC_EXIT=$?
if [ $SYNC_EXIT -ne 0 ]; then
  echo "[$(date)] S3 sync failed with exit code $SYNC_EXIT"
  exit $SYNC_EXIT
fi

echo "[$(date)] ==> S3 sync complete."

if [ -f "$DUMP_FILE" ]; then
  rm -f "$DUMP_FILE"
  echo "[$(date)] ==> Removed temporary dump file: $DUMP_FILE"
fi

echo "[$(date)] ==> Sync completed successfully."