// Each stub logs what it was asked to do. The database is one word in
// state/db, the running release one word in state/pm2 and its pid in state/pid,
// and a release is the word in its directory's `release` file. The release's
// secrets_run.sh marks what it runs with FROM_SECRETS, which every stub
// reading secrets requires.
export const STUBS: Record<string, string> = {
  flock: `
    echo flock >> "$STATE/log"
    [ "\${LOCK:-ok}" = ok ]`,
  sleep: "exit 0",
  unzip: `
    dir="\${@: -1}"
    mkdir -p "$dir/server" "$dir/scripts"
    echo new > "$dir/release"
    printf '%s\n' '#!/usr/bin/env bash' \
      '[ "\${SECRETS:-ok}" = ok ] || { echo "secrets_run.sh: could not read secrets" >&2; exit 1; }' \
      'FROM_SECRETS=1 exec "$@"' > "$dir/scripts/secrets_run.sh"
    echo unzip >> "$STATE/log"
    [ "\${UNZIP:-ok}" = ok ]`,
  bun: `
    [ "$1" = install ] || [ -n "\${FROM_SECRETS:-}" ] || { echo "bun $* without secrets" >&2; exit 2; }
    case "$1 \${2:-}" in
      "install --frozen-lockfile")
        echo install >> "$STATE/log"
        [ -z "\${AUTORESTART:-}" ] || { echo new > "$STATE/pm2"; echo 101 > "$STATE/pid"; }
        [ "\${INSTALL:-ok}" = ok ];;
      "src/config/validate-env.ts ")
        echo validate >> "$STATE/log"
        [ "\${CONFIG:-ok}" = ok ];;
      "scripts/streak-recognition-removal.ts state")
        [ ! -e "$STATE/unreadable" ] || exit 1
        [ ! -e "$STATE/slow" ] || echo "query is slow: SELECT 1"
        cat "$STATE/db";;
      "scripts/streak-recognition-removal.ts revert")
        echo revert >> "$STATE/log"
        [ "\${REVERT:-ok}" = ok ] || exit 1
        echo pending > "$STATE/db";;
      *) echo "unexpected bun $*" >&2; exit 2;;
    esac`,
  bunx: `
    [ -n "\${FROM_SECRETS:-}" ] || { echo "migrate without secrets" >&2; exit 2; }
    echo "migrate while running: $(cat "$STATE/pm2")" >> "$STATE/log"
    [ "$(cat "$STATE/db")" = pending ] || { [ "\${MIGRATE:-ok}" = ok ]; exit; }
    case "\${MIGRATE:-ok}" in
      ok) echo applied > "$STATE/db";;
      guard) echo "Streak recognition is still in use" >&2; exit 1;;
      disconnect) echo applied > "$STATE/db"; exit 1;;
      unknown) touch "$STATE/unreadable"; exit 1;;
      slow) echo applied > "$STATE/db"; touch "$STATE/slow"; exit 1;;
      interrupt) kill -TERM "$PPID";;
      interrupt-after-commit) echo applied > "$STATE/db"; kill -TERM "$PPID";;
    esac`,
  pm2: `
    if { : >&9; } 2>/dev/null; then echo "pm2 inherited the lock fd" >&2; exit 3; fi
    case "$1" in
      delete)
        echo "delete $(cat "$STATE/pm2")" >> "$STATE/log"
        [ "\${STOP:-ok}" = ok ] || exit 1
        [ -n "$(cat "$STATE/pm2")" ] || exit 1
        : > "$STATE/pm2";;
      start)
        [ "\${*:2}" = "$HOME/secrets_run.sh --name nest-app --interpreter bash --exp-backoff-restart-delay=1000 -- bun src/main.ts" ] \\
          || { echo "pm2 start without secrets" >&2; exit 2; }
        release=$(cat ../release)
        echo "start $release" >> "$STATE/log"
        [ "$release" != old ] || [ "\${START_OLD:-ok}" = ok ] || exit 1
        echo "$release" > "$STATE/pm2"
        echo $(( $(cat "$STATE/pid") + 1 )) > "$STATE/pid";;
      restart)
        release=$(cat "$HOME/nest-backend/release")
        echo "restart $release" >> "$STATE/log"
        [ "\${RESTART:-ok}" = ok ] || exit 1
        echo "$release" > "$STATE/pm2"
        echo $(( $(cat "$STATE/pid") + 1 )) > "$STATE/pid";;
      pid)
        [ "\${PID:-ok}" = ok ] || exit 1
        [ "\${LATE_PID:-ok}" = ok ] || ! grep -qx install "$STATE/log" || exit 1
        [ ! -e "$STATE/cold" ] || { rm "$STATE/cold"; echo "[PM2] Spawning PM2 daemon"; echo "[PM2] PM2 Successfully daemonized"; }
        cat "$STATE/pid";;
      jlist)
        if [ -n "$(cat "$STATE/pm2")" ]; then echo '[{"name":"nest-app"}]'; else echo '[]'; fi;;
      save) ;;
      *) echo "unexpected pm2 $*" >&2; exit 2;;
    esac`,
  mv: `
    [ "$1" != nest-backend-deploy-backup ] || [ "\${PUT_BACK:-ok}" = ok ] || exit 1
    exec /bin/mv "$@"`,
  rm: `
    [ "$2" != nest-backend ] || [ "\${REMOVE:-ok}" = ok ] || exit 1
    exec /bin/rm "$@"`,
  curl: `
    [[ " $* " == *" --retry 10 --retry-delay 3 --retry-connrefused "* ]] || { echo "curl without retries" >&2; exit 2; }
    running=$(cat "$STATE/pm2")
    echo "health $running" >> "$STATE/log"
    [ "$running" != new ] || [ "\${HEALTH:-ok}" = ok ]`,
};
