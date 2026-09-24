#!/usr/bin/env bash
set -euo pipefail

mkdir -p .scratch/pr-screenshots
curl --fail --silent --show-error --location https://get.maestro.mobile.dev | bash
echo "$HOME/.maestro/bin" >> "$GITHUB_PATH"

case "$NATIVE_PLATFORM" in
  ios)
    brew install postgresql@17
    pg_bin="$(brew --prefix postgresql@17)/bin"
    echo "$pg_bin" >> "$GITHUB_PATH"
    "$pg_bin/initdb" -D "$PWD/.scratch/pr-screenshots/pgdata" -U postgres -A trust
    "$pg_bin/pg_ctl" -D "$PWD/.scratch/pr-screenshots/pgdata" -l "$PWD/.scratch/pr-screenshots/postgres.log" start
    xcrun simctl list devices available
    ;;
  android)
    sudo apt-get update -qq
    sudo apt-get install -y postgresql libnss3 libatk-bridge2.0-0 libxkbcommon0 libgbm1 libasound2t64
    sudo service postgresql start
    sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres'"
    sudo chmod 666 /dev/kvm
    sdkmanager 'platform-tools' 'platforms;android-35' 'system-images;android-35;google_apis;x86_64' 'emulator'
    echo no | avdmanager create avd --force --name screenshots --package 'system-images;android-35;google_apis;x86_64' --device pixel_6
    "$ANDROID_HOME/emulator/emulator" -avd screenshots -no-window -no-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect > .scratch/pr-screenshots/emulator.log 2>&1 &
    adb wait-for-device
    for _ in {1..120}; do
      if [[ "$(adb shell getprop sys.boot_completed | tr -d '\r')" == 1 ]]; then
        adb shell input keyevent 82
        exit 0
      fi
      sleep 2
    done
    echo 'Android emulator did not finish booting' >&2
    exit 1
    ;;
  *)
    echo "Unsupported native platform: $NATIVE_PLATFORM" >&2
    exit 1
    ;;
esac
