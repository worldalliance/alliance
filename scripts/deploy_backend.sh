#!/usr/bin/env bash
#
# Swaps ~/nest-build.zip in as ~/nest-backend and migrates. The deploy workflow
# runs it on the backend host with NODE_ENV exported; everything that reads the
# app's secrets runs through secrets_run.sh.
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

# pm2 prints its banner to stdout when the call spawns its daemon.
backend_pid () {
  local out
  out=$(pm2 pid nest-app 9>&-) || return 1
  grep -xE '[1-9][0-9]*' <<< "$out" || true
}

old_pid=$(backend_pid) || { echo "::error::Could not read the backend's pid from pm2; nothing was changed."; exit 1; }
rm -rf nest-backend-deploy-backup || true
mv nest-backend nest-backend-deploy-backup || true

with_secrets () {
  ~/secrets_run.sh "$@"
}

start_backend () {
  pm2 delete nest-app 9>&- || true
  pm2 start ~/secrets_run.sh --name nest-app --interpreter bash --exp-backoff-restart-delay=1000 9>&- -- bun src/main.ts
}

migrate () {
  with_secrets bunx typeorm-ts-node-commonjs --dataSource src/datasources/dataSource.ts migration:run
}

put_back_old_release () {
  cd ~/ || return 1
  [ -d nest-backend-deploy-backup ] || return 1
  rm -rf nest-backend || return 1
  mv nest-backend-deploy-backup nest-backend
}

# Only for failures before the old backend is stopped. A process that exits
# meanwhile, or was between restarts as the deploy began, comes back from the
# path pm2 recorded, ~/nest-backend/server, which holds the new release until
# the old one is moved back; a changed pid shows it.
keep_old_release () {
  local new_pid
  trap - ERR
  if [ ! -d ~/nest-backend-deploy-backup ]; then
    echo "::error::$1 There was no previous release to put back."
  elif ! put_back_old_release; then
    echo "::error::$1 The previous release could not be put back.$(backup_note)"
  elif ! new_pid=$(backend_pid); then
    echo "::error::$1 The previous release is back, but pm2 could not report whether the old backend is still running; check it by hand."
  elif [ -z "$old_pid$new_pid" ]; then
    echo "::error::$1 pm2 reported no running backend as the deploy began or since, so none was started; check \`pm2 list\`."
  elif [ "$new_pid" = "$old_pid" ]; then
    echo "::error::$1 The old backend is still running."
  elif pm2 restart nest-app 9>&-; then
    echo "::error::$1 The old backend restarted during the deploy, so it was restarted again from the old release."
  else
    echo "::error::$1 The old backend restarted during the deploy and could not be restarted from the old release."
  fi
  exit 1
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
  [ -d nest-backend-deploy-backup ] || return 0
  put_back_old_release || return 1
  cd ~/nest-backend/server || return 1
  start_backend
}

backup_note () {
  if [ -d ~/nest-backend-deploy-backup ]; then
    echo " The old release is in ~/nest-backend-deploy-backup, which the next deploy replaces."
  fi
}

rollback () {
  trap - ERR
  echo "Deployment failed - rolling back"
  restore_old_release && exit 1
  if stop_backend; then
    echo "::error::Could not restart the old release. The backend is left stopped; start a release by hand.$(backup_note)"
  else
    echo "::error::Could not restart the old release, and the new backend could not be stopped; check \`pm2 list\`.$(backup_note)"
  fi
  exit 1
}
trap 'keep_old_release "Preparing the new release failed."' ERR

health_check () {
  sleep 10
  # The public /api/ path goes through the nginx vhost deploy-react-app owns,
  # not this job; verify-api covers it.
  curl --silent --fail --show-error --max-time 10 --retry 10 --retry-delay 3 --retry-connrefused http://localhost:3005/ > /dev/null
}

mkdir -p ~/nest-backend
unzip -o ~/nest-build.zip -d ~/nest-backend

cd ~/nest-backend || keep_old_release "Could not enter the new release."
bun install --frozen-lockfile
# Installs hardlink out of the cache, so node_modules survives this.
bun pm cache rm || echo "::warning::bun pm cache rm failed; the disk fills up unless the Bun cache is cleared"

cd ~/nest-backend/server || keep_old_release "Could not enter the new release."
# The running backend restarts through ~/secrets_run.sh, so the new copy
# replaces it only once it has loaded the new config.
bash ../scripts/secrets_run.sh bun src/config/validate-env.ts \
  || keep_old_release "The new release's config failed to load from Parameter Store."
install -m 755 ../scripts/secrets_run.sh ~/secrets_run.sh.new
mv -f ~/secrets_run.sh.new ~/secrets_run.sh

# set -E would run the ERR trap inside the substitution too, then again out here.
removal=$(trap - ERR; with_secrets bun scripts/streak-recognition-removal.ts state) \
  || keep_old_release "Could not read the streak recognition removal state."

case "$removal" in
  absent|applied)
    migrate || keep_old_release "Migrations failed."
    trap rollback ERR
    start_backend
    pm2 save 9>&-
    health_check
    exit 0
    ;;
  pending) ;;
  *)
    echo "Streak recognition removal state: $removal"
    keep_old_release "Unexpected streak recognition removal state."
    ;;
esac

trap - ERR

fail_stopped () {
  echo "::error::$1 The backend is left stopped; restore the schema and start a release by hand.$(backup_note)"
  stop_backend || true
  exit 1
}

recover_after_cleanup () {
  trap '' HUP INT TERM PIPE
  echo "Deployment failed after streak recognition's removal committed - reverting it"
  cd ~/nest-backend/server || fail_stopped "Could not enter the new release."
  stop_backend || fail_stopped "Could not stop the new backend."
  with_secrets bun scripts/streak-recognition-removal.ts revert || fail_stopped "Could not revert the streak recognition removal."
  restore_old_release || fail_stopped "Reverted the removal but could not restart the old release."
  exit 1
}

# The connection can drop after the commit, so the migration record decides.
recover_by_record () {
  trap '' HUP INT TERM PIPE
  cd ~/nest-backend/server || fail_stopped "$1 and the new release could not be entered."
  removal=$(with_secrets bun scripts/streak-recognition-removal.ts state) \
    || fail_stopped "$1 and the removal's outcome could not be read; check that this host can reach Parameter Store and the database."
  case "$removal" in
    pending)
      echo "$1 before streak recognition's removal committed - restoring the old release"
      restore_old_release || fail_stopped "Could not restart the old release."
      exit 1
      ;;
    applied) recover_after_cleanup ;;
    *)
      echo "Streak recognition removal state: $removal"
      fail_stopped "$1 and the removal's outcome was not recognized."
      ;;
  esac
}

# A signal ending the run would otherwise leave the backend stopped with
# nothing in the log saying so.
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
