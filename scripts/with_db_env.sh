#!/usr/bin/env bash
#
# Runs on a backend host, from a release in ~/nest-backend: runs a command with
# libpq's PG* variables set for that environment's database, as the server's
# own login.

set -euo pipefail

usage() {
  echo "usage: with_db_env.sh <staging|production> <command> [args...]" >&2
  exit 2
}
case "${1:-}" in
  staging) store=staging ;;
  production) store=prod ;;
  *) usage ;;
esac
[ "$#" -ge 2 ] || usage

PGDATABASE=$(/home/ec2-user/.bun/bin/bun \
  /home/ec2-user/nest-backend/scripts/deployed-db-name.ts "$1")
# Verifies the RDS certificate, as the server's own connection does.
export PGDATABASE PGSSLMODE=verify-full \
  PGSSLROOTCERT=/home/ec2-user/nest-backend/server/src/config/rds-us-west-2-bundle.pem
# shellcheck disable=SC2016 # the inner shell expands them
exec /home/ec2-user/secrets_run.sh \
  --path "/alliance/$store/server/" DB_HOST DB_USERNAME DB_PASSWORD -- bash -c \
  'export PGHOST=$DB_HOST PGUSER=$DB_USERNAME PGPASSWORD=$DB_PASSWORD; exec "$@"' \
  _ "${@:2}"
