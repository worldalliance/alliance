#!/usr/bin/env bash
set -euo pipefail

# Case-sensitive: GitHub payloads carry the canonical login casing.
case "$GITHUB_USERNAME" in
  CaseyManning) mention="<@U08P0THG741>" ;;
  charleslien)  mention="<@U0A0WQQM8HZ>" ;;
  chonboncode)  mention="<@U0BSDDY7Y9F>" ;;
  dorey)        mention="<@U0BLD70L7DY>" ;;
  GrantHough)   mention="<@U0ACKHT60F4>" ;;
  markzxu)      mention="<@U08P0TJ283T>" ;;
  nuakashborde) mention="<@U0B2T057ZPU>" ;;
  sidsquid)     mention="<@U08NU231VGS>" ;;
  *)            mention="" ;;
esac

echo "mention=$mention" >> "$GITHUB_OUTPUT"
