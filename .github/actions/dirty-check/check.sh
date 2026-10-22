#!/usr/bin/env bash
set -euo pipefail

case "$CHECK" in
  exists)
    if [ ! -f dirty.txt ]; then
      echo "dirty.txt is missing. Restore it as an empty file; its content is what freezes production releases."
      exit 1
    fi
    echo "dirty.txt exists. Continuing."
    ;;
  empty)
    if [ -s dirty.txt ]; then
      echo "dirty.txt has content. Aborting."
      exit 1
    fi
    echo "dirty.txt is empty or not found. Continuing."
    ;;
  *)
    echo "unknown check: $CHECK" >&2
    exit 1
    ;;
esac
