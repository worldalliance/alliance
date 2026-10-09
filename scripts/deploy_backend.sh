#!/usr/bin/env bash
#
# Swaps ~/nest-build.zip in as ~/nest-backend and migrates. The deploy workflow
# runs it on the backend host with the app's environment exported.

set -Euo pipefail

cd ~/ || exit 1

# Held until ~/nest-backend is final, rollback included; the prod → staging
# sync takes it around its own migrate-and-swap. pm2 calls close it so a daemon
# they spawn can't hold it.
exec 9>>~/migrate.lock
flock -w 300 9 || { echo "could not take ~/migrate.lock; a prod → staging sync may hold it"; exit 1; }

rm -rf nest-backend-deploy-backup || true
mv nest-backend nest-backend-deploy-backup || true

restore_old_release () {
  cd ~/ || return 1
  pm2 delete nest-app 9>&- || true
  if [ -d "nest-backend-deploy-backup" ]; then
    rm -rf nest-backend
    mv nest-backend-deploy-backup nest-backend
    cd ~/nest-backend/server || return 1
    pm2 start "bun src/main.ts" --name nest-app --interpreter none 9>&-
  fi
}

rollback () {
  trap - ERR
  echo "Deployment failed - rolling back"
  restore_old_release
  exit 1
}
trap rollback ERR

health_check () {
  sleep 10
  # The public /api/ path goes through the nginx vhost deploy-react-app owns,
  # not this job; verify-api covers it.
  curl --silent --fail --show-error --max-time 10 http://localhost:3005/ > /dev/null
}

mkdir -p ~/nest-backend
unzip -o ~/nest-build.zip -d ~/nest-backend

cd ~/nest-backend || rollback
bun install --frozen-lockfile

cd ~/nest-backend/server || rollback
bunx typeorm-ts-node-commonjs --dataSource src/datasources/dataSource.ts migration:run

pm2 delete nest-app 9>&- || true
pm2 start "bun src/main.ts" --name nest-app --interpreter none 9>&-
pm2 save 9>&-
health_check
