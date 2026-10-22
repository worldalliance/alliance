#!/usr/bin/env bash
#
# Swaps ~/nest-build.zip in as ~/nest-backend and migrates. The deploy workflow
# runs it on the backend host with the app's environment exported.
#
# A release that applies RemoveStreakRecognition stops the old backend before
# migrating, because the old code writes the columns that migration drops, and
# undoes that migration if the new backend then fails to come up healthy.

set -Euo pipefail

cd ~/ || exit 1

# Held until ~/nest-backend is final, rollback included; the prod → staging
# sync takes it around its own migrate-and-swap. pm2 calls close it so a daemon
# they spawn can't hold it.
exec 9>>~/migrate.lock
flock -w 300 9 || { echo "could not take ~/migrate.lock; a prod → staging sync may hold it"; exit 1; }

rm -rf nest-backend-deploy-backup || true
mv nest-backend nest-backend-deploy-backup || true

start_backend () {
  pm2 delete nest-app 9>&- || true
  pm2 start "bun src/main.ts" --name nest-app --interpreter none 9>&-
}

migrate () {
  bunx typeorm-ts-node-commonjs --dataSource src/datasources/dataSource.ts migration:run
}

stop_backend () {
  local list
  pm2 delete nest-app 9>&- || true
  list=$(pm2 jlist 9>&-) || return 1
  [[ $list != *'"name":"nest-app"'* ]]
}

restore_old_release () {
  cd ~/ || return 1
  pm2 delete nest-app 9>&- || true
  if [ -d "nest-backend-deploy-backup" ]; then
    rm -rf nest-backend
    mv nest-backend-deploy-backup nest-backend
    cd ~/nest-backend/server || return 1
    start_backend
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
# set -E would run rollback inside the substitution too, then again out here.
removal=$(trap - ERR; bun scripts/streak-recognition-removal.ts state) || rollback

case "$removal" in
  absent|applied)
    migrate
    start_backend
    pm2 save 9>&-
    health_check
    exit 0
    ;;
  pending) ;;
  *)
    echo "Unexpected streak recognition removal state: $removal"
    rollback
    ;;
esac

trap - ERR

fail_stopped () {
  echo "::error::$1 The backend is left stopped; restore the schema and start a release by hand."
  stop_backend || true
  exit 1
}

recover_after_cleanup () {
  trap '' HUP INT TERM PIPE
  echo "Deployment failed after streak recognition's removal committed - reverting it"
  cd ~/nest-backend/server || fail_stopped "Could not enter the new release."
  stop_backend || fail_stopped "Could not stop the new backend."
  bun scripts/streak-recognition-removal.ts revert || fail_stopped "Could not revert the streak recognition removal."
  restore_old_release || fail_stopped "Reverted the removal but could not restart the old release."
  exit 1
}

# The connection can drop after the commit, so the migration record decides.
recover_by_record () {
  trap '' HUP INT TERM PIPE
  cd ~/nest-backend/server || fail_stopped "$1 and the new release could not be entered."
  removal=$(bun scripts/streak-recognition-removal.ts state) || removal=""
  case "$removal" in
    pending)
      echo "$1 before streak recognition's removal committed - restoring the old release"
      restore_old_release || fail_stopped "Could not restart the old release."
      exit 1
      ;;
    applied) recover_after_cleanup ;;
    *) fail_stopped "$1 and the removal's outcome could not be read." ;;
  esac
}

# A cancelled job or a closed SSH session would otherwise leave the backend
# stopped with nothing in the log saying so.
trap 'recover_by_record "The deploy was interrupted"' HUP INT TERM PIPE

echo "This release removes streak recognition; stopping the backend before migrating"
if ! stop_backend; then
  trap '' HUP INT TERM PIPE
  echo "Could not stop the old backend; nothing was migrated"
  restore_old_release || fail_stopped "Could not restart the old release."
  exit 1
fi

migrate || recover_by_record "Migrations failed"

start_backend || recover_after_cleanup
pm2 save 9>&- || recover_after_cleanup
health_check || recover_after_cleanup
