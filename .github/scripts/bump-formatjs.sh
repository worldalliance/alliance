#!/usr/bin/env bash
# Bumps @formatjs/intl-datetimeformat within server/package.json's range, and
# keeps the bump only when it changes add-all-tz.js.
# Writes version to $GITHUB_OUTPUT when it keeps the bump.
set -euo pipefail
cd "$(dirname "$0")/../../server"

tzdata() { shasum < "$(bun -p 'require.resolve("@formatjs/intl-datetimeformat/add-all-tz.js")')" | cut -c1-12; }

before=$(tzdata)
bun update @formatjs/intl-datetimeformat
if [ "$(tzdata)" != "$before" ]; then
  echo "version=$(bun -p 'require("@formatjs/intl-datetimeformat/package.json").version')" >> "$GITHUB_OUTPUT"
  exit 0
fi
git checkout -- package.json ../bun.lock
bun install --frozen-lockfile
